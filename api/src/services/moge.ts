import { execFileSync } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { recordCall, reserveCall } from "./costs.js";
import type { NormalField } from "./ground-normals.js";
export const MOGE_VERSION =
	"a348ab675ed1480931bc1750085d6d3dace1350358e9d3afc4cca57258820c99";
const pending = new Map<string, Promise<NormalField>>();
function pixels(
	path: string,
	w: number,
	h: number,
	kind: "rgb" | "gray",
): Buffer {
	return execFileSync(
		"magick",
		[path, "-resize", `${w}x${h}!`, "-depth", "8", `${kind}:-`],
		{ maxBuffer: 128 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] },
	);
}
export async function readMoge(directory: string): Promise<NormalField> {
	const meta = JSON.parse(
		await readFile(resolve(directory, "bin_meta.json"), "utf8"),
	);
	const w = meta.width,
		h = meta.height;
	if (
		!Number.isInteger(w) ||
		!Number.isInteger(h) ||
		w < 2 ||
		h < 2 ||
		w * h > 16_000_000
	)
		throw new Error("Invalid MoGe dimensions");
	const bytes = await readFile(resolve(directory, "points.bin"));
	if (bytes.length !== w * h * 12) throw new Error("Invalid MoGe XYZ data");
	const points = new Float32Array(w * h * 3);
	for (let i = 0; i < points.length; i++) points[i] = bytes.readFloatLE(i * 4);
	const rgb = pixels(resolve(directory, "normal.png"), w, h, "rgb"),
		mask = pixels(resolve(directory, "mask.png"), w, h, "gray");
	if (rgb.length !== w * h * 3 || mask.length !== w * h)
		throw new Error("Invalid MoGe image data");
	return {
		width: w,
		height: h,
		points,
		normals: Float32Array.from(rgb, (v) => v / 127.5 - 1),
		valid: Uint8Array.from(mask, (v) => (v > 127 ? 1 : 0)),
	};
}
export async function mogeNormals(
	bytes: Buffer,
	hash: string,
	cacheRoot: string,
): Promise<NormalField> {
	const key = resolve(cacheRoot, `${hash}-moge2-${MOGE_VERSION}`);
	const existing = pending.get(key);
	if (existing) return existing;
	const work = (async () => {
		try {
			const m = JSON.parse(
				await readFile(resolve(key, "complete.json"), "utf8"),
			);
			if (
				m.version === MOGE_VERSION &&
				m.fp16 === false &&
				m.imageHash === hash
			)
				return await readMoge(key);
		} catch {}
		const token = process.env.REPLICATE_API_TOKEN;
		if (!token) throw new Error("REPLICATE_API_TOKEN is not configured");
		const headers = {
			Authorization: `Bearer ${token}`,
			"User-Agent": "Anima/1.0",
			"Content-Type": "application/json",
		};
		const started = Date.now();
		type Prediction = {
			id: string;
			status: string;
			output?: Record<string, string>;
		};
		const saved = await readFile(resolve(key, "prediction.json"), "utf8")
			.then((text) => JSON.parse(text))
			.catch(() => undefined);
		let prediction: Prediction;
		if (
			saved?.version === MOGE_VERSION &&
			saved.imageHash === hash &&
			/^[a-zA-Z0-9_-]+$/.test(saved.id)
		) {
			const response = await fetch(
				`https://api.replicate.com/v1/predictions/${saved.id}`,
				{ headers, signal: AbortSignal.timeout(30_000) },
			);
			if (!response.ok)
				throw new Error(
					`MoGe saved prediction status failed (${response.status})`,
				);
			prediction = (await response.json()) as Prediction;
		} else {
			reserveCall("perception");
			const response = await fetch("https://api.replicate.com/v1/predictions", {
				method: "POST",
				headers,
				body: JSON.stringify({
					version: MOGE_VERSION,
					input: {
						image: `data:image/png;base64,${bytes.toString("base64")}`,
						fp16: false,
					},
				}),
				signal: AbortSignal.timeout(60_000),
			});
			if (!response.ok)
				throw new Error(
					`MoGe prediction submission failed (${response.status})`,
				);
			prediction = (await response.json()) as Prediction;
			if (!/^[a-zA-Z0-9_-]+$/.test(prediction.id))
				throw new Error("Invalid MoGe prediction identifier");
			await mkdir(key, { recursive: true });
			await writeFile(
				resolve(key, "prediction.json"),
				JSON.stringify({
					id: prediction.id,
					version: MOGE_VERSION,
					imageHash: hash,
				}),
			);
		}
		while (!["succeeded", "failed", "canceled"].includes(prediction.status)) {
			if (Date.now() - started > 600_000)
				throw new Error(`MoGe prediction ${prediction.id} is still pending`);
			await new Promise((r) => setTimeout(r, 1500));
			const poll = await fetch(
				`https://api.replicate.com/v1/predictions/${prediction.id}`,
				{ headers, signal: AbortSignal.timeout(30_000) },
			);
			if (!poll.ok)
				throw new Error(`MoGe prediction status failed (${poll.status})`);
			prediction = (await poll.json()) as Prediction;
		}
		if (prediction.status !== "succeeded" || !prediction.output)
			throw new Error(`MoGe prediction ${prediction.id} ${prediction.status}`);
		for (const [field, file] of [
			["bin_meta_json", "bin_meta.json"],
			["points_bin", "points.bin"],
			["normal_png", "normal.png"],
			["mask_png", "mask.png"],
		]) {
			const url = new URL(prediction.output[field]);
			if (
				url.protocol !== "https:" ||
				!(
					url.hostname === "replicate.delivery" ||
					url.hostname.endsWith(".replicate.delivery")
				)
			)
				throw new Error("Invalid MoGe output URL");
			const download = await fetch(url, {
				signal: AbortSignal.timeout(60_000),
			});
			if (!download.ok)
				throw new Error(`MoGe artifact download failed (${download.status})`);
			await writeFile(
				resolve(key, `${file}.tmp`),
				Buffer.from(await download.arrayBuffer()),
			);
			await rename(resolve(key, `${file}.tmp`), resolve(key, file));
		}
		const field = await readMoge(key);
		await writeFile(
			resolve(key, "complete.json"),
			JSON.stringify({ version: MOGE_VERSION, imageHash: hash, fp16: false }),
		);
		recordCall("moge2", Date.now() - started);
		return field;
	})();
	pending.set(key, work);
	try {
		return await work;
	} finally {
		pending.delete(key);
	}
}
