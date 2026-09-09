#!/usr/bin/env tsx
import { File } from "node:buffer";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import process from "node:process";
import { fal } from "@fal-ai/client";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env"), quiet: true });
config({ path: resolve(process.cwd(), "../../.env"), quiet: true });

interface Options {
	image: string;
	output: string;
	prompt: string;
	model: string;
	aspectRatio: "16:9" | "9:16" | "auto";
	duration: "4s" | "6s" | "8s";
	resolution: "720p" | "1080p" | "4k";
	generateAudio: boolean;
	constraintPreset: "walk" | "talk" | "none";
}

function parseArgs(argv: string[]): Options {
	if (argv.includes("--help") || argv.includes("-h")) {
		console.log(`Usage:
  npx tsx scripts/video-generate.ts --image <ref.png> --prompt <prompt> --output <video.mp4>

Options:
  --model <model>          fal.ai model, default fal-ai/veo3.1/fast/image-to-video. Alias: veo
  --aspect <ratio>         auto, 16:9, or 9:16. Default 9:16
  --duration <seconds>     4s, 6s, or 8s. Default 4s
  --resolution <res>       720p, 1080p, or 4k. Default 720p
  --audio <true|false>     Default false
  --constraint-preset <walk|talk|none> Default walk
`);
		process.exit(0);
	}

	const options: Partial<Options> = {
		model: "fal-ai/veo3.1/fast/image-to-video",
		aspectRatio: "9:16",
		duration: "4s",
		resolution: "720p",
		generateAudio: false,
		constraintPreset: "walk",
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		const next = argv[index + 1];
		if (!arg.startsWith("--")) continue;
		if (!next || next.startsWith("--")) throw new Error(`Missing value for ${arg}`);
		index += 1;

		switch (arg) {
			case "--image":
				options.image = next;
				break;
			case "--output":
				options.output = next;
				break;
			case "--prompt":
				options.prompt = next;
				break;
			case "--model":
				options.model = next === "veo" ? "fal-ai/veo3.1/fast/image-to-video" : next;
				break;
			case "--aspect":
			case "--aspect-ratio":
				options.aspectRatio = parseAspect(next);
				break;
			case "--duration":
				options.duration = parseDuration(next);
				break;
			case "--resolution":
				options.resolution = parseResolution(next);
				break;
			case "--audio":
				options.generateAudio = parseBool(next);
				break;
			case "--constraint-preset":
				options.constraintPreset = parseConstraintPreset(next);
				break;
			default:
				throw new Error(`Unknown option ${arg}`);
		}
	}

	if (!options.image) throw new Error("--image is required");
	if (!options.output) throw new Error("--output is required");
	if (!options.prompt) throw new Error("--prompt is required");

	return options as Options;
}

function parseAspect(value: string): Options["aspectRatio"] {
	if (value === "auto" || value === "16:9" || value === "9:16") return value;
	throw new Error("--aspect must be auto, 16:9, or 9:16");
}

function parseDuration(value: string): Options["duration"] {
	const normalized = value.endsWith("s") ? value : `${value}s`;
	if (normalized === "4s" || normalized === "6s" || normalized === "8s") return normalized;
	throw new Error("--duration must be 4s, 6s, or 8s");
}

function parseResolution(value: string): Options["resolution"] {
	if (value === "720p" || value === "1080p" || value === "4k") return value;
	throw new Error("--resolution must be 720p, 1080p, or 4k");
}

function parseBool(value: string): boolean {
	if (value === "true") return true;
	if (value === "false") return false;
	throw new Error(`Expected boolean, got ${value}`);
}

function parseConstraintPreset(value: string): Options["constraintPreset"] {
	if (value === "walk" || value === "talk" || value === "none") return value;
	throw new Error("--constraint-preset must be walk, talk, or none");
}

function contentTypeFor(path: string): string {
	const extension = extname(path).toLowerCase();
	if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
	if (extension === ".webp") return "image/webp";
	return "image/png";
}

async function uploadImage(path: string): Promise<string> {
	const filePath = resolve(path);
	const data = await readFile(filePath);
	return fal.storage.upload(
		new File([data], basename(filePath), { type: contentTypeFor(filePath) }),
	);
}

function outputUrl(data: unknown): string {
	if (!data || typeof data !== "object") throw new Error("fal result is empty");
	const maybe = data as { video?: { url?: unknown }; url?: unknown };
	if (typeof maybe.video?.url === "string") return maybe.video.url;
	if (typeof maybe.url === "string") return maybe.url;
	throw new Error("Could not find video URL in fal output");
}

async function download(url: string, output: string): Promise<void> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Download failed ${response.status}: ${response.statusText}`);
	await mkdir(dirname(output), { recursive: true });
	await writeFile(output, new Uint8Array(await response.arrayBuffer()));
}

function withSpriteConstraints(
	prompt: string,
	preset: Options["constraintPreset"],
): string {
	if (preset === "none") return prompt;

	const shared = `

Sprite generation constraints:
- Preserve the exact character identity, clothing, silhouette, proportions, and illustration style.
- Plain flat #828282 gray background only.
- No floor plane, no props, no scene, no cast shadow, no contact shadow, no camera motion.
- Smooth loopable point-and-click adventure animation.`;

	if (preset === "talk") {
		return `${prompt}${shared}
- Keep the character seated in the same pose and anchor.
- Whole seated body, boots, and attached bag must remain fully visible with generous padding.
- Animate subtle mouth, jaw, head, and breathing movement only.
- Do not stand up, walk, wave, change outfit, change camera angle, or move across frame.`;
	}

	return `${prompt}${shared}
- Full body visible, feet fully in frame, no cropping.
- Smooth loopable point-and-click adventure walk animation.`;
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const token = process.env.FAL_KEY;
	if (!token) throw new Error("FAL_KEY is required");
	fal.config({ credentials: token });

	const imageUrl = await uploadImage(options.image);
	const input = {
		image_url: imageUrl,
		prompt: withSpriteConstraints(options.prompt, options.constraintPreset),
		aspect_ratio: options.aspectRatio,
		duration: options.duration,
		resolution: options.resolution,
		generate_audio: options.generateAudio,
		auto_fix: false,
		safety_tolerance: "4",
	};

	console.log(`Generating ${basename(options.output)} with ${options.model}`);
	const result = await fal.subscribe(options.model, {
		input,
		logs: true,
		onQueueUpdate: (update) => {
			if (update.status === "IN_PROGRESS") {
				for (const log of update.logs ?? []) console.log(log.message);
			}
		},
	});

	await download(outputUrl(result.data), options.output);
	await writeFile(
		`${options.output}.manifest.json`,
		`${JSON.stringify(
			{
				provider: "fal.ai",
				endpoint: options.model,
				requestId: result.requestId,
				sourceImage: options.image,
				output: options.output,
				input,
			},
			null,
			2,
		)}\n`,
	);
	console.log(`Saved video to ${options.output}`);
	console.log(`Source image: ${options.image}`);
	console.log(`Output dir: ${dirname(options.output)}`);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
