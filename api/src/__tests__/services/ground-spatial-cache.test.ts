// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { spatialMaskCache } from "../../services/ground-spatial-cache.js";

it("reuses matching SAM2 inference across report folders and keeps it after report removal", async () => {
	const root = await mkdtemp(join(tmpdir(), "floor-spatial-"));
	try {
		const report = join(root, "old-report");
		await mkdir(report);
		const seeds = [{ x: 0.4, y: 0.8 }];
		await writeFile(
			join(report, "sam2-fallback.png"),
			"cached inference bytes",
		);
		await writeFile(
			join(root, "image-floor-v17.json"),
			JSON.stringify({
				guidance: { areas: seeds.map((seed) => ({ seed })) },
				artifactsDirectory: report,
			}),
		);
		const cached = await spatialMaskCache(root, "image", seeds);
		expect(await readFile(cached, "utf8")).toBe("cached inference bytes");
		await rm(report, { recursive: true });
		expect(await spatialMaskCache(root, "image", seeds)).toBe(cached);
		expect(await readFile(cached, "utf8")).toBe("cached inference bytes");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

it("never reuses another image or changed spatial seeds", async () => {
	const root = await mkdtemp(join(tmpdir(), "floor-spatial-"));
	try {
		const report = join(root, "old-report");
		await mkdir(report);
		await writeFile(join(report, "sam2-fallback.png"), "wrong inputs");
		await writeFile(
			join(root, "image-floor-v17.json"),
			JSON.stringify({
				guidance: { areas: [{ seed: { x: 0.4, y: 0.8 } }] },
				artifactsDirectory: report,
			}),
		);
		for (const [image, seeds] of [
			["other-image", [{ x: 0.4, y: 0.8 }]],
			["image", [{ x: 0.5, y: 0.8 }]],
		] as const) {
			const cached = await spatialMaskCache(root, image, seeds);
			await expect(readFile(cached)).rejects.toMatchObject({ code: "ENOENT" });
		}
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
