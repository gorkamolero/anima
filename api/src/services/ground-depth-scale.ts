import type { Raster } from "./ground.js";
import type { ScaleReference } from "./ground-calibration.js";
import type { NormalField } from "./ground-normals.js";

const median = (values: number[]) => {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)];
};

type Result =
	| { status: "rejected"; reason: string }
	| {
			status: "accepted";
			horizonY: number;
			slope: number;
			referenceFootY: number;
			referenceFactor: number;
			relativeError: number;
			referenceDepth: number;
	  };

/** Transfer a known object's height by relative camera depth, without assuming
 * its base lies on the floor plane (doors can stand on raised porches).
 * Row medians suppress isolated geometry outliers. A non-planar or laterally
 * varying floor is rejected rather than forced into the runtime's y-only model.
 */
export function calibrateDepthScale(
	field: NormalField,
	floor: Raster,
	reference: ScaleReference,
): Result {
	const reject = (reason: string): Result => ({ status: "rejected", reason });
	const { width, height, points, valid } = field;
	const rect = reference.rect;
	if (
		rect.y <= 0 ||
		rect.y + rect.height >= 1 ||
		rect.x < 0 ||
		rect.x + rect.width > 1
	)
		return reject("reference height is not fully visible");
	const depths: number[] = [];
	const edgeDepths: number[] = [];
	const rows: { y: number; inverse: number }[] = [];
	const samples: { y: number; inverse: number }[] = [];
	for (let y = 0; y < height; y++) {
		const row: number[] = [];
		for (let x = 0; x < width; x++) {
			const i = y * width + x;
			const z = points[i * 3 + 2];
			if (!valid[i] || !Number.isFinite(z) || z <= 0) continue;
			const u = (x + 0.5) / width;
			const v = (y + 0.5) / height;
			if (
				v > rect.y + rect.height * 0.2 &&
				v < rect.y + rect.height * 0.8 &&
				((u >= rect.x && u < rect.x + rect.width * 0.15) ||
					(u > rect.x + rect.width * 0.85 && u <= rect.x + rect.width))
			)
				edgeDepths.push(z);
			if (
				u > rect.x + rect.width * 0.3 &&
				u < rect.x + rect.width * 0.7 &&
				v > rect.y + rect.height * 0.2 &&
				v < rect.y + rect.height * 0.8
			)
				depths.push(z);
			if (
				floor.data[
					Math.min(floor.height - 1, Math.floor(v * floor.height)) *
						floor.width +
						Math.min(floor.width - 1, Math.floor(u * floor.width))
				]
			) {
				row.push(1 / z);
				if (x % 4 === 0 && y % 4 === 0) samples.push({ y: v, inverse: 1 / z });
			}
		}
		if (row.length >= 8)
			rows.push({ y: (y + 0.5) / height, inverse: median(row) });
	}
	if (depths.length < 16) return reject("insufficient reference depth");
	const referenceDepth = median(depths);
	if (edgeDepths.length < 8) return reject("insufficient reference edge depth");
	if (Math.abs(median(edgeDepths) / referenceDepth - 1) > 0.25)
		return reject("reference interior and edges lie at different depths");
	if (median(depths.map((z) => Math.abs(z / referenceDepth - 1))) > 0.15)
		return reject("inconsistent reference depth");
	if (rows.length < 16 || rows[rows.length - 1].y - rows[0].y < 0.15)
		return reject("insufficient floor depth coverage");
	const fit = (data: typeof rows) => {
		const my = data.reduce((s, p) => s + p.y, 0) / data.length;
		const mz = data.reduce((s, p) => s + p.inverse, 0) / data.length;
		const a =
			data.reduce((s, p) => s + (p.y - my) * (p.inverse - mz), 0) /
			data.reduce((s, p) => s + (p.y - my) ** 2, 0);
		return { a, b: mz - a * my };
	};
	let line = fit(rows);
	for (let n = 0; n < 3; n++) {
		const errors = rows.map((p) =>
			Math.abs(p.inverse - (line.a * p.y + line.b)),
		);
		const tolerance = Math.max(1e-8, 3 * median(errors));
		const inliers = rows.filter((_, i) => errors[i] <= tolerance);
		if (inliers.length < rows.length * 0.7)
			return reject("inconsistent floor plane");
		line = fit(inliers);
	}
	const horizonY = (-line.b / line.a) * 1080;
	if (
		!(line.a > 0) ||
		!Number.isFinite(horizonY) ||
		horizonY >= rows[0].y * 1080
	)
		return reject("invalid floor projection");
	const errors = samples
		.map((p) => Math.abs((line.a * p.y + line.b) / p.inverse - 1))
		.sort((a, b) => a - b);
	const relativeError = errors[Math.floor(errors.length * 0.9)];
	if (!Number.isFinite(relativeError) || relativeError > 0.15)
		return reject("floor cannot be represented by a single depth line");
	const adultHeight = (rect.height * 1080 * 1.75) / reference.realHeightM;
	const slope = (adultHeight * referenceDepth * line.a) / (1080 * 1059 * 0.5);
	const referenceFootY = median(rows.map((p) => p.y));
	return {
		status: "accepted",
		horizonY,
		slope,
		referenceFootY,
		referenceFactor: slope * (referenceFootY * 1080 - horizonY),
		relativeError,
		referenceDepth,
	};
}
