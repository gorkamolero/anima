import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

/** Scene image edits through Codex's built-in image generator, with the same
 * input image and the same prompt the fal path receives. Every result is
 * stored with a manifest of exactly what the generator was given, so an image
 * can be traced to its references and regenerated the same way. */

const WORK = resolve(process.cwd(), "../tmp/codex-image");
const ROOT = resolve(process.cwd(), "..");

/** The fixed frame around the pipeline's prompt. Nothing scene-specific here. */
function brief(prompt: string, outputPath: string): string {
	return [
		"You are the image step of a 2D adventure-game background pipeline. One image is attached: the current background. Produce the edited background described below and save it as a PNG at exactly this path:",
		outputPath,
		"",
		"Rules:",
		"- Use your built-in image generation with the attached image as the input to edit. Do not call any third-party image API, do not write code that needs an API key, do not modify any repository file, do not commit.",
		"- Match the attached image's style exactly: the same flat opaque gouache fills, the same ink line weight, the same level of cartoon simplification, the same saturation. The result must look like it belongs to the same set of backgrounds as the attached image.",
		"- Keep the attached image's camera height, lens, horizon line and the amount of walkable ground at the bottom of the frame.",
		"- Output 1920x1080 landscape. If the generator returns another size, resize to exactly 1920x1080 with Python PIL (`uv run --with pillow python3`).",
		"",
		"Edit to make:",
		prompt,
		"",
		"When the file is written, print only its absolute path on the last line.",
	].join("\n");
}

export async function editWithCodex(
	background: Blob,
	prompt: string,
): Promise<string> {
	await mkdir(WORK, { recursive: true });
	const input = Buffer.from(await background.arrayBuffer());
	const key = createHash("sha256")
		.update(input)
		.update(prompt)
		.digest("hex")
		.slice(0, 24);
	const inputPath = resolve(WORK, `${key}-input.png`);
	const outputPath = resolve(WORK, `${key}-output.png`);
	const logPath = resolve(WORK, `${key}-codex.txt`);
	await writeFile(inputPath, input);
	const text = brief(prompt, outputPath);
	await new Promise<void>((done, fail) => {
		const child = spawn(
			"codex",
			[
				"exec",
				"--skip-git-repo-check",
				"--dangerously-bypass-approvals-and-sandbox",
				"-C",
				ROOT,
				"-i",
				inputPath,
				"-o",
				logPath,
				"-",
			],
			{ stdio: ["pipe", "ignore", "pipe"] },
		);
		let err = "";
		child.stderr.on("data", (d) => {
			err += String(d);
		});
		child.on("error", fail);
		child.on("close", (code) =>
			code === 0
				? done()
				: fail(new Error(`codex image step exited ${code}: ${err.slice(-300)}`)),
		);
		child.stdin.end(text);
	});
	const output = await readFile(outputPath).catch(() => {
		throw new Error("codex image step wrote no output image");
	});
	await writeFile(
		resolve(WORK, `${key}-manifest.json`),
		JSON.stringify(
			{
				generator: "codex built-in image generation",
				references: [
					{
						role: "background to edit",
						sha256: createHash("sha256").update(input).digest("hex"),
					},
				],
				prompt,
				brief: text,
				output: outputPath,
				date: new Date().toISOString(),
			},
			null,
			2,
		),
	);
	return `data:image/png;base64,${output.toString("base64")}`;
}
