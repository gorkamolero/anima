// @vitest-environment node
import { expect, it } from "vitest";
import {
	type FloorPlane,
	measureFloorPlane,
	measureObjectHeight,
	projectObjectScale,
} from "../../services/ground-object-height.js";

function object(bottom = 0, height = 1, unit = 1) {
	const width = 40,
		rows = 40,
		points = new Float32Array(width * rows * 3),
		valid = new Uint8Array(width * rows).fill(1),
		data = new Array<number>(width * rows).fill(0);
	// A known vertical face viewed with a tilted camera. Up is(0,-.8,.6).
	for (let y = 1; y < rows - 1; y++)
		for (let x = 1; x < width - 1; x++) {
			const i = y * width + x,
				h = bottom + (height * (y - 1)) / (rows - 3);
			points[i * 3] = (x / width) * unit;
			points[i * 3 + 1] = -0.8 * h * unit;
			points[i * 3 + 2] = (5 + 0.6 * h) * unit;
			data[i] = 1;
		}
	const plane: FloorPlane = {
		normal: [0, -0.8, 0.6],
		center: [0, 0, 5 * unit],
		residual90: 0,
	};
	return {
		field: {
			width,
			height: rows,
			points,
			valid,
			normals: new Float32Array(points.length),
		},
		mask: { width, height: rows, data },
		plane,
	};
}
it("measures vertical height under camera tilt rather than image-box extent", () => {
	const { field, mask, plane } = object();
	const r = measureObjectHeight(field, mask, plane);
	expect(r.status).toBe("measured");
	if (r.status !== "measured") throw Error(r.reason);
	expect(r.extent).toBeCloseTo(35 / 37, 5);
});
it("rejects a shelf board floating well above the floor", () => {
	const { field, mask, plane } = object(2, 0.1);
	expect(measureObjectHeight(field, mask, plane)).toEqual({
		status: "rejected",
		reason: "object base is missing or elevated above the reference floor",
	});
});
it("makes the same completeness decision in arbitrary depth units", () => {
	for (const units of [0.1, 1, 100]) {
		const { field, mask, plane } = object(2, 0.1, units);
		expect(measureObjectHeight(field, mask, plane).status).toBe("rejected");
	}
});
it("rejects cropped and missing-depth references", () => {
	const { field, mask, plane } = object();
	mask.data[3] = 1;
	expect(measureObjectHeight(field, mask, plane).status).toBe("rejected");
	mask.data[3] = 0;
	field.valid.fill(0, 0, 800);
	expect(measureObjectHeight(field, mask, plane)).toEqual({
		status: "rejected",
		reason: "insufficient valid object geometry",
	});
});
it("does not claim completeness when floor geometry is uncertain", () => {
	const { field, mask, plane } = object();
	plane.residual90 = 0.2;
	expect(measureObjectHeight(field, mask, plane).status).toBe("rejected");
});
it("fits a tilted floor orientation from independent plane points", () => {
	const { field, mask } = object();
	for (let y = 0; y < 40; y++)
		for (let x = 0; x < 40; x++) {
			const i = y * 40 + x;
			field.points[i * 3] = x / 10;
			field.points[i * 3 + 1] = y * 0.06;
			field.points[i * 3 + 2] = 5 + y * 0.08;
			mask.data[i] = 1;
		}
	const plane = measureFloorPlane(field, mask);
	expect(plane).toBeDefined();
	expect(plane?.normal[1]).toBeCloseTo(-0.8, 5);
	expect(plane?.normal[2]).toBeCloseTo(0.6, 5);
	expect(plane?.residual90).toBeLessThan(1e-5);
});

it("projects a physical adult height with an independently specified pinhole camera", () => {
	const width = 80,
		height = 80,
		points = new Float32Array(width * height * 3),
		valid = new Uint8Array(width * height).fill(1),
		data = new Array<number>(width * height).fill(0);
	for (let y = 0; y < height; y++)
		for (let x = 0; x < width; x++) {
			const i = y * width + x,
				v = (y + 0.5) / height,
				z = v > 0.3 ? 1.5 / (v - 0.3) : 10;
			points[i * 3] = ((x + 0.5) / width - 0.5) * z;
			points[i * 3 + 1] = (v - 0.3) * z;
			points[i * 3 + 2] = z;
			data[i] = v > 0.5 ? 1 : 0;
		}
	const field = {
		width,
		height,
		points,
		valid,
		normals: new Float32Array(points.length),
	};
	const result = projectObjectScale(
		field,
		{ width, height, data },
		{ normal: [0, -1, 0], center: [0, 1.5, 0], residual90: 0 },
		1,
		2,
	);
	expect(result.status).toBe("estimated");
	if (result.status !== "estimated") throw Error(result.reason);
	//1unit is2m; camera height is3m. At y=.9, a1.75m adult spans378px.
	expect(result.slope * (972 - result.horizonY) * 529.5).toBeCloseTo(378, 3);
});
