// @vitest-environment node
import { expect, it } from "vitest";
import { estimateMetricScale } from "../../services/ground-metric-scale.js";

function room() {
	const width = 40,
		height = 40;
	const points = new Float32Array(width * height * 3);
	const valid = new Uint8Array(width * height).fill(1);
	const data = new Array<number>(width * height).fill(0);
	for (let y = 0; y < height; y++)
		for (let x = 0; x < width; x++) {
			const i = y * width + x,
				v = (y + 0.5) / height;
			const z = v > 0.3 ? 1.5 / (v - 0.3) : 10;
			points.set([((x + 0.5) / width - 0.5) * z, (v - 0.3) * z, z], i * 3);
			data[i] = v > 0.5 ? 1 : 0;
		}
	return {
		field: {
			width,
			height,
			points,
			valid,
			normals: new Float32Array(points.length),
		},
		floor: { width, height, data },
	};
}

it("projects an adult from independent metric camera geometry", () => {
	const { field, floor } = room();
	const r = estimateMetricScale(field, floor);
	expect(r.status).toBe("estimated");
	if (r.status !== "estimated") throw Error(r.reason);
	// Camera is 1.5m above a level floor; the horizon is y324.
	// A 1.75m adult at y972 must be 756px tall by similar triangles.
	expect(r.horizonY).toBeCloseTo(324, 3);
	expect(r.slope * (972 - r.horizonY) * 529.5).toBeCloseTo(756, 3);
});

it("rejects missing geometry instead of inventing scale", () => {
	const { field, floor } = room();
	field.valid.fill(0);
	expect(estimateMetricScale(field, floor).status).toBe("rejected");
});

it("rejects a floor with substantial height variation", () => {
	const { field, floor } = room();
	for (let y = 0; y < field.height; y++)
		for (let x = 0; x < field.width; x++) {
			const i = y * field.width + x;
			if (floor.data[i]) field.points[i * 3 + 1] += ((x / 4 + y / 4) % 3) * 0.5;
		}
	expect(estimateMetricScale(field, floor).status).toBe("rejected");
});
