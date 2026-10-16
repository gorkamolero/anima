// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetCallLimits } from "../../services/costs.js";
import { MOGE_VERSION, mogeNormals } from "../../services/moge.js";

vi.mock("node:child_process", () => ({
	execFileSync: (_cmd: string, args: string[]) =>
		Buffer.alloc(args.at(-1) === "rgb:-" ? 12 : 4, 255),
}));
const roots: string[] = [];
afterEach(async () => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	resetCallLimits();
	await Promise.all(
		roots.splice(0).map((p) => rm(p, { recursive: true, force: true })),
	);
});
async function fixture() {
	const root = await mkdtemp(join(tmpdir(), "anima-moge-"));
	roots.push(root);
	const dir = join(root, `test-image-moge2-${MOGE_VERSION}`);
	await mkdir(dir);
	return { root, dir };
}
const output = {
	bin_meta_json: "https://replicate.delivery/meta",
	points_bin: "https://replicate.delivery/points",
	normal_png: "https://replicate.delivery/normal",
	mask_png: "https://replicate.delivery/mask",
};
function download(url: string) {
	return url.endsWith("/meta")
		? new Response(JSON.stringify({ width: 2, height: 2 }))
		: new Response(new Uint8Array(url.endsWith("/points") ? 48 : 4));
}
describe("MoGe cache and billing", () => {
	it("reads a complete image cache without a token or a paid reservation", async () => {
		const { root, dir } = await fixture();
		await writeFile(
			join(dir, "complete.json"),
			JSON.stringify({
				version: MOGE_VERSION,
				imageHash: "test-image",
				fp16: false,
			}),
		);
		await writeFile(
			join(dir, "bin_meta.json"),
			JSON.stringify({ width: 2, height: 2 }),
		);
		await writeFile(join(dir, "points.bin"), Buffer.alloc(48));
		vi.stubEnv("REPLICATE_API_TOKEN", "");
		vi.stubEnv("MAX_PERCEPTION_CALLS", "0");
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);
		expect(
			(await mogeNormals(Buffer.from("image"), "test-image", root)).width,
		).toBe(2);
		expect(fetch).not.toHaveBeenCalled();
	});
	it("pins full precision, deduplicates concurrent calls and saves a reusable result", async () => {
		const { root } = await fixture();
		vi.stubEnv("REPLICATE_API_TOKEN", "test-only-placeholder");
		vi.stubEnv("MAX_PERCEPTION_CALLS", "1");
		const fetch = vi.fn(async (url: string, init?: RequestInit) => {
			if (init?.method === "POST") {
				const body = JSON.parse(String(init.body));
				expect(body.version).toBe(MOGE_VERSION);
				expect(body.input.fp16).toBe(false);
				return Response.json({
					id: "prediction1",
					status: "succeeded",
					output,
				});
			}
			return download(String(url));
		});
		vi.stubGlobal("fetch", fetch);
		const [a, b] = await Promise.all([
			mogeNormals(Buffer.from("image"), "test-image", root),
			mogeNormals(Buffer.from("image"), "test-image", root),
		]);
		expect(a).toBe(b);
		expect(fetch).toHaveBeenCalledTimes(5);
		await mogeNormals(Buffer.from("image"), "test-image", root);
		expect(fetch).toHaveBeenCalledTimes(5);
	});
	it("resumes a saved prediction without spending another call", async () => {
		const { root, dir } = await fixture();
		await writeFile(
			join(dir, "prediction.json"),
			JSON.stringify({
				id: "prediction1",
				version: MOGE_VERSION,
				imageHash: "test-image",
			}),
		);
		vi.stubEnv("REPLICATE_API_TOKEN", "test-only-placeholder");
		vi.stubEnv("MAX_PERCEPTION_CALLS", "0");
		const fetch = vi.fn(async (url: string) =>
			String(url).includes("/v1/predictions/")
				? Response.json({ id: "prediction1", status: "succeeded", output })
				: download(String(url)),
		);
		vi.stubGlobal("fetch", fetch);
		expect(
			(await mogeNormals(Buffer.from("image"), "test-image", root)).height,
		).toBe(2);
		expect(fetch).toHaveBeenCalledTimes(5);
	});
});
