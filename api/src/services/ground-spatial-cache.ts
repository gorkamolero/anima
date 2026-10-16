import { createHash } from "node:crypto";
import { copyFile, readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

type Seed = { x: number; y: number };

/** SAM2 is keyed by the source image and seed inputs, never a report folder. */
export async function spatialMaskCache(
	root: string,
	imageHash: string,
	seeds: readonly Seed[],
): Promise<string> {
	const signature = JSON.stringify(seeds);
	const seedHash = createHash("sha256").update(signature).digest("hex");
	const path = resolve(root, `${imageHash}-sam2-v1-${seedHash}.png`);
	if (
		await readFile(path).then(
			() => true,
			() => false,
		)
	)
		return path;
	// Migrate existing inference output without paying for the same inputs again.
	const prefix = `${imageHash}-floor-v`;
	const records = (await readdir(root)).filter(
		(name) =>
			name.startsWith(prefix) && /^\d+\.json$/.test(name.slice(prefix.length)),
	);
	for (const name of records.reverse()) {
		const record = JSON.parse(await readFile(resolve(root, name), "utf8"));
		const previous = record.guidance?.areas?.map(
			(area: { seed: Seed }) => area.seed,
		);
		if (!record.artifactsDirectory || JSON.stringify(previous) !== signature)
			continue;
		try {
			await copyFile(
				resolve(record.artifactsDirectory, "sam2-fallback.png"),
				path,
			);
			return path;
		} catch {
			// An older report may have been removed; another matching record can survive.
		}
	}
	return path;
}
