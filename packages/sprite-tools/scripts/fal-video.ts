#!/usr/bin/env tsx
import { File } from "node:buffer";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import process from "node:process";
import { fal } from "@fal-ai/client";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env"), quiet: true });
config({ path: resolve(process.cwd(), "../../.env"), quiet: true });

type Command = "generate" | "remove-bg";

interface GenerateOptions {
	command: "generate";
	image: string;
	output: string;
	prompt: string;
	model: string;
	aspectRatio: "16:9" | "9:16" | "auto";
	duration: "4s" | "6s" | "8s";
	resolution: "720p" | "1080p" | "4k";
	generateAudio: boolean;
	mode: "image" | "reference";
	constraintPreset: "walk" | "talk" | "none";
}

interface RemoveBgOptions {
	command: "remove-bg";
	video: string;
	output: string;
	backgroundColor: string;
	codec: string;
	preserveAudio: boolean;
}

type Options = GenerateOptions | RemoveBgOptions;

function usage(): never {
	console.log(`Usage:
  npx tsx scripts/fal-video.ts generate --image <source.png> --prompt <prompt> --output <raw.mp4>
  npx tsx scripts/fal-video.ts remove-bg --video <raw.mp4> --output <alpha.webm>

Generate options:
  --model <slug>          Default fal-ai/veo3.1/fast/image-to-video
  --mode <image|reference> Default image
  --aspect <ratio>        auto, 16:9, or 9:16. Default 9:16
  --duration <seconds>    4s, 6s, or 8s. Default 4s
  --resolution <res>      720p, 1080p, or 4k. Default 720p
  --audio <true|false>    Default false
  --constraint-preset <walk|talk|none> Default walk

Remove background options:
  --background <color>    Transparent, Black, White, Gray, Red, Green, Blue, Yellow, Cyan, Magenta, Orange. Default Transparent
  --codec <codec>         Default webm_vp9
  --preserve-audio <bool> Default false
`);
	process.exit(0);
}

function parseArgs(argv: string[]): Options {
	if (argv.includes("--help") || argv.includes("-h")) usage();
	const command = argv[0] as Command | undefined;
	if (command !== "generate" && command !== "remove-bg") usage();

	const values = new Map<string, string>();
	for (let index = 1; index < argv.length; index += 1) {
		const arg = argv[index];
		if (!arg.startsWith("--")) throw new Error(`Unexpected argument ${arg}`);
		const next = argv[index + 1];
		if (!next || next.startsWith("--")) throw new Error(`Missing value for ${arg}`);
		values.set(arg, next);
		index += 1;
	}

	if (command === "generate") {
		const duration = normalizeDuration(values.get("--duration") ?? "4s");
		const resolution = values.get("--resolution") ?? "720p";
		const aspectRatio = values.get("--aspect") ?? values.get("--aspect-ratio") ?? "9:16";
		const mode = values.get("--mode") ?? "image";
		const constraintPreset = values.get("--constraint-preset") ?? "walk";
		if (mode !== "image" && mode !== "reference") {
			throw new Error("--mode must be image or reference");
		}
		if (
			constraintPreset !== "walk" &&
			constraintPreset !== "talk" &&
			constraintPreset !== "none"
		) {
			throw new Error("--constraint-preset must be walk, talk, or none");
		}
		if (aspectRatio !== "auto" && aspectRatio !== "16:9" && aspectRatio !== "9:16") {
			throw new Error("--aspect must be auto, 16:9, or 9:16");
		}
		if (resolution !== "720p" && resolution !== "1080p" && resolution !== "4k") {
			throw new Error("--resolution must be 720p, 1080p, or 4k");
		}
		const image = required(values, "--image");
		return {
			command,
			image,
			output: required(values, "--output"),
			prompt: required(values, "--prompt"),
			model:
				values.get("--model") ??
				(mode === "reference"
					? "fal-ai/veo3.1/reference-to-video"
					: "fal-ai/veo3.1/fast/image-to-video"),
			aspectRatio,
			duration,
			resolution,
			generateAudio: parseBool(values.get("--audio"), false),
			mode,
			constraintPreset,
		};
	}

	return {
		command,
		video: required(values, "--video"),
		output: required(values, "--output"),
		backgroundColor: values.get("--background") ?? "Transparent",
		codec: values.get("--codec") ?? "webm_vp9",
		preserveAudio: parseBool(values.get("--preserve-audio"), false),
	};
}

function required(values: Map<string, string>, name: string): string {
	const value = values.get(name);
	if (!value) throw new Error(`${name} is required`);
	return value;
}

function normalizeDuration(value: string): GenerateOptions["duration"] {
	const normalized = value.endsWith("s") ? value : `${value}s`;
	if (normalized === "4s" || normalized === "6s" || normalized === "8s") {
		return normalized;
	}
	throw new Error("--duration must be 4s, 6s, or 8s");
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
	if (value === undefined) return fallback;
	if (value === "true") return true;
	if (value === "false") return false;
	throw new Error(`Expected boolean, got ${value}`);
}

function contentTypeFor(path: string): string {
	const extension = extname(path).toLowerCase();
	if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
	if (extension === ".webp") return "image/webp";
	if (extension === ".mp4") return "video/mp4";
	if (extension === ".mov") return "video/quicktime";
	if (extension === ".webm") return "video/webm";
	return "image/png";
}

async function uploadFile(path: string): Promise<string> {
	const filePath = resolve(path);
	const data = await readFile(filePath);
	return fal.storage.upload(
		new File([data], basename(filePath), { type: contentTypeFor(filePath) }),
	);
}

function configureFal(): void {
	const token = process.env.FAL_KEY;
	if (!token) throw new Error("FAL_KEY is required");
	fal.config({ credentials: token });
}

async function download(url: string, output: string): Promise<void> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Download failed ${response.status}: ${response.statusText}`);
	}
	await mkdir(dirname(output), { recursive: true });
	await writeFile(output, new Uint8Array(await response.arrayBuffer()));
}

function outputUrl(data: unknown): string {
	if (!data || typeof data !== "object") throw new Error("fal result is empty");
	const maybe = data as { video?: { url?: unknown }; url?: unknown };
	if (typeof maybe.video?.url === "string") return maybe.video.url;
	if (typeof maybe.url === "string") return maybe.url;
	throw new Error(`Could not find video url in fal result`);
}

function withSpriteConstraints(
	prompt: string,
	preset: GenerateOptions["constraintPreset"],
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

async function runGenerate(options: GenerateOptions): Promise<void> {
	const imageUrl = await uploadFile(options.image);
	const input =
		options.mode === "reference"
			? {
					prompt: withSpriteConstraints(
						options.prompt,
						options.constraintPreset,
					),
					image_urls: [imageUrl],
					aspect_ratio: options.aspectRatio === "auto" ? "9:16" : options.aspectRatio,
					duration: options.duration,
					resolution: options.resolution,
					generate_audio: options.generateAudio,
					auto_fix: false,
					safety_tolerance: "4",
				}
			: {
					prompt: withSpriteConstraints(
						options.prompt,
						options.constraintPreset,
					),
					image_url: imageUrl,
					aspect_ratio: options.aspectRatio,
					duration: options.duration,
					resolution: options.resolution,
					generate_audio: options.generateAudio,
					auto_fix: false,
					safety_tolerance: "4",
				};

	console.log(`fal generate: ${options.model}`);
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
	await writeManifest(options.output, {
		provider: "fal.ai",
		endpoint: options.model,
		requestId: result.requestId,
		sourceImage: options.image,
		output: options.output,
		input,
	});
	console.log(`Saved ${options.output}`);
}

async function runRemoveBg(options: RemoveBgOptions): Promise<void> {
	const videoUrl = await uploadFile(options.video);
	const input = {
		video_url: videoUrl,
		background_color: options.backgroundColor,
		output_container_and_codec: options.codec,
		preserve_audio: options.preserveAudio,
	};
	console.log("fal remove-bg: bria/video/background-removal");
	const result = await fal.subscribe("bria/video/background-removal", {
		input,
		logs: true,
		onQueueUpdate: (update) => {
			if (update.status === "IN_PROGRESS") {
				for (const log of update.logs ?? []) console.log(log.message);
			}
		},
	});
	await download(outputUrl(result.data), options.output);
	await writeManifest(options.output, {
		provider: "fal.ai",
		endpoint: "bria/video/background-removal",
		requestId: result.requestId,
		sourceVideo: options.video,
		output: options.output,
		input,
	});
	console.log(`Saved ${options.output}`);
}

async function writeManifest(output: string, manifest: Record<string, unknown>): Promise<void> {
	await writeFile(`${output}.manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	configureFal();
	if (options.command === "generate") await runGenerate(options);
	else await runRemoveBg(options);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
