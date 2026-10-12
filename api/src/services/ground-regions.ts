import type { GroundRegion, Raster } from "./ground.js";

/** Local depth samples, not a fitted global plane. Rectangles only index the
 * regions: the full-resolution floor intersection in mask defines membership. */
export function depthRegions(
	floor: Raster,
	depth: Raster,
	stairs: Raster | undefined,
	referenceDepth: number,
	referenceFactor: number,
): GroundRegion[] {
	const regions: GroundRegion[] = [];
	for (const kind of ["stairs", "floor"] as const)
		for (let row = 0; row < 3; row++)
			for (let col = 0; col < 3; col++) {
				const x0 = Math.floor((col * floor.width) / 3),
					x1 = Math.floor(((col + 1) * floor.width) / 3);
				const y0 = Math.floor((row * floor.height) / 3),
					y1 = Math.floor(((row + 1) * floor.height) / 3);
				const mask = {
					...floor,
					data: floor.data.map((v, i) =>
						v &&
						(kind === "stairs" ? stairs?.data[i] : !stairs?.data[i]) &&
						i % floor.width >= x0 &&
						i % floor.width < x1 &&
						Math.floor(i / floor.width) >= y0 &&
						Math.floor(i / floor.width) < y1
							? 1
							: 0,
					),
				};
				const scaleAtY: Array<{ y: number; scaleFactor: number }> = [];
				for (let y = y0; y < y1; y += 3) {
					const values: number[] = [];
					for (let yy = y; yy < Math.min(y + 3, y1); yy++)
						for (let x = x0; x < x1; x++)
							if (mask.data[yy * floor.width + x]) {
								const d =
									depth.data[
										Math.floor((yy * depth.height) / floor.height) *
											depth.width +
											Math.floor((x * depth.width) / floor.width)
									];
								if (
									Number.isFinite(d) &&
									d > 0 &&
									Number.isFinite(referenceDepth) &&
									referenceDepth > 0 &&
									Number.isFinite(referenceFactor) &&
									referenceFactor > 0
								)
									values.push(d);
							}
					if (values.length) {
						values.sort((a, b) => a - b);
						scaleAtY.push({
							y: (Math.min(y + 1.5, y1 - 0.5) / floor.height) * 1080,
							scaleFactor: Math.max(
								0.18,
								Math.min(
									1.5,
									(values[Math.floor(values.length / 2)] /
										Math.max(1, referenceDepth)) *
										referenceFactor,
								),
							),
						});
					}
				}
				if (!scaleAtY.length) continue;
				regions.push({
					id: `${kind}-${col}-${row}`,
					kind,
					mask,
					polygon: [
						{ x: (x0 / floor.width) * 1920, y: (y0 / floor.height) * 1080 },
						{ x: (x1 / floor.width) * 1920, y: (y0 / floor.height) * 1080 },
						{ x: (x1 / floor.width) * 1920, y: (y1 / floor.height) * 1080 },
						{ x: (x0 / floor.width) * 1920, y: (y1 / floor.height) * 1080 },
					],
					scaleAtY,
					interpolation: "linear",
					source: "relative-depth",
				});
			}
	return regions;
}
