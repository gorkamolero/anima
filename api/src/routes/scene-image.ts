import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fal } from "@fal-ai/client";
import { Hono } from "hono";
import { z } from "zod";
import { ANCHORS, imagePath } from "../lib/backgrounds.js";
import { recordCall, reserveCall } from "../services/costs.js";
import {
	getWorldDb,
	type VisualState,
	visualSchema,
} from "../services/world.js";

const REPOSITORY_ROOT = existsSync(resolve(process.cwd(), "adventures"))
	? process.cwd()
	: resolve(process.cwd(), "..");
const PUBLIC_DIRECTORY = resolve(
	REPOSITORY_ROOT,
	"adventures/shadow-over-innsmouth/public",
);
const DEFAULT_GENERATED_DIRECTORY = resolve(PUBLIC_DIRECTORY, "generated");
const SCENE_BACKGROUNDS: Record<string, string> = {
	inside: imagePath(ANCHORS.inside),
	outside: resolve(
		PUBLIC_DIRECTORY,
		"backgrounds/bus-station-kat-seated-composite-v1.png",
	),
};

const ART_STYLE = [
	"A richly colored, painterly cartoon style evoking 1920s New England coastal horror. Fully saturated with intentional palette choices, with a painterly gouache feel, visible brushwork, clean but slightly sketchy medium-weight ink lines, rich shadows, atmospheric depth, and period-accurate weathered architecture.",
	"Use the exterior palette: deep teal-blue #2A5F7A, coral orange #E07850, warm gold #D4A853, weathered wood #6B4423, sea green #5A7A6A, amber gold #D4A020, and silver blue #8A9CAA.",
].join(" ");

const requestSchema = z
	.object({
		scene: z.string().min(1),
		imagePrompt: z.string().min(1),
		visualState: visualSchema,
		baseBackground: z.string().optional(),
		sourceImage: z.string().optional(),
	})
	.strict();

interface SceneImageOptions {
	generatedDirectory?: string;
	backgrounds?: Record<string, string>;
	editImage?: (background: Blob, prompt: string) => Promise<string>;
	fetchImage?: typeof fetch;
}

export function sceneImageCacheName(
	location: string,
	visual: VisualState,
	baseBackground: string,
): string {
	return `${createHash("sha256")
		.update(
			JSON.stringify({
				location,
				timeOfDay: visual.timeOfDay,
				weather: visual.weather,
				damage: visual.damage,
				npcsPresent: [...new Set(visual.npcsPresent)].sort(),
				baseBackground,
			}),
		)
		.digest("hex")}.png`;
}

async function editWithFal(background: Blob, prompt: string): Promise<string> {
	const imageUrl = await fal.storage.upload(background);
	// ponytail: one retry — fal's edit endpoint fails ~1 in 4 calls; a queue with backoff if that gets worse
	try {
		return await editOnce(imageUrl, prompt);
	} catch {
		return await editOnce(imageUrl, prompt);
	}
}

async function editOnce(imageUrl: string, prompt: string): Promise<string> {
	reserveCall("image");
	const started = Date.now();
	const result = await fal.subscribe("fal-ai/nano-banana-2/edit", {
		input: {
			prompt,
			image_urls: [imageUrl],
			aspect_ratio: "16:9",
			limit_generations: true,
			num_images: 1,
			output_format: "png",
		},
	});
	recordCall("image", Date.now() - started);
	const outputUrl = result.data.images[0]?.url;
	if (!outputUrl) throw new Error("fal returned no edited image");
	return outputUrl;
}

export function createSceneImageRoutes(options: SceneImageOptions = {}): Hono {
	const routes = new Hono();
	const generatedDirectory =
		options.generatedDirectory ?? DEFAULT_GENERATED_DIRECTORY;
	const backgrounds = options.backgrounds ?? SCENE_BACKGROUNDS;
	const editImage = options.editImage ?? editWithFal;
	const fetchImage = options.fetchImage ?? fetch;

	routes.post("/scene-image", async (c) => {
		const parsed = requestSchema.safeParse(
			await c.req.json().catch(() => null),
		);
		if (!parsed.success) {
			return c.json({ error: "Invalid scene image request" }, 400);
		}

		const { scene, imagePrompt, visualState, baseBackground, sourceImage } =
			parsed.data;
		const backgroundPath = sourceImage
			? imagePath(sourceImage)
			: backgrounds[scene];
		if (!backgroundPath) return c.json({ error: "Unknown scene" }, 404);

		const filename = sceneImageCacheName(
			scene,
			visualState,
			baseBackground ?? ANCHORS[scene] ?? backgroundPath,
		);
		const outputPath = `${generatedDirectory}/${filename}`;
		// ponytail: absolute URL on the api origin — Vite's publicDir cache misses files written seconds ago
		const publicUrl = `${new URL(c.req.url).origin}/generated/${filename}`;

		try {
			await mkdir(generatedDirectory, { recursive: true });
			// ponytail: immutable disk cache keyed by scene and prompt; add shared storage when deployment has multiple machines.
			if (
				await access(outputPath)
					.then(() => true)
					.catch(() => false)
			) {
				await (await getWorldDb()).execute({
					sql: "INSERT OR REPLACE INTO images VALUES (?, ?)",
					args: [filename, `/generated/${filename}`],
				});
				recordCall("image", 0, true);
				return c.json({ url: publicUrl, cached: true });
			}

			const source = await readFile(backgroundPath);
			const prompt = [
				`Edit only this change into the current background: ${imagePrompt}`,
				ART_STYLE,
				"Keep composition, camera angle, horizon and ground exactly as in the input image.",
			].join(" ");
			const remoteUrl = await editImage(
				new Blob([source], { type: "image/png" }),
				prompt,
			);
			const response = await fetchImage(remoteUrl);
			if (!response.ok) {
				throw new Error(`Unable to download fal image: ${response.status}`);
			}
			await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
			await (await getWorldDb()).execute({
				sql: "INSERT OR REPLACE INTO images VALUES (?, ?)",
				args: [filename, `/generated/${filename}`],
			});
			return c.json({ url: publicUrl, cached: false });
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Scene image generation failed";
			return c.json({ error: message, source: basename(backgroundPath) }, 502);
		}
	});

	routes.get("/scene-image", async (c) => {
		const scene = c.req.query("scene") ?? "outside";
		const parsed = visualSchema.safeParse(
			JSON.parse(c.req.query("visualState") ?? "null"),
		);
		if (!parsed.success) return c.json({ error: "Invalid visual state" }, 400);
		const base = c.req.query("baseBackground") ?? ANCHORS[scene];
		if (!base) return c.json({ error: "Unknown scene" }, 404);
		const filename = sceneImageCacheName(scene, parsed.data, base);
		const result = await (await getWorldDb()).execute({
			sql: "SELECT path FROM images WHERE cache_key = ?",
			args: [filename],
		});
		return c.json({
			url: result.rows.length
				? `${new URL(c.req.url).origin}${result.rows[0].path}`
				: null,
			cached: result.rows.length > 0,
		});
	});
	return routes;
}

export const sceneImageRoutes = createSceneImageRoutes();
