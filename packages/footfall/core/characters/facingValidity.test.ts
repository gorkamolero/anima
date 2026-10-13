import { expect, it } from "vitest";
import { stanceFacesHeading } from "./walkHeading";

it("uses the reviewer's positive view-ray correction", () => {
	const end = { x: 3, y: 4 };
	const angle = Math.PI / 2 - Math.atan2(3, 4);
	const start = { x: end.x - Math.cos(angle), y: end.y - Math.sin(angle) };
	expect(stanceFacesHeading(start, end, "away")).toBe(true);
	expect(stanceFacesHeading(start, end, "right")).toBe(false);
});
it("rejects lateral crabbing and accepts the 30 degree boundary", () => {
	const start = { x: 0, y: 0 };
	expect(stanceFacesHeading(start, { x: 1, y: 0 }, "away", false)).toBe(false);
	expect(
		stanceFacesHeading(
			start,
			{ x: Math.cos(Math.PI / 6), y: 0.5 },
			"right",
			false,
		),
	).toBe(true);
	expect(
		stanceFacesHeading(
			start,
			{ x: Math.cos(Math.PI / 6 + 0.01), y: Math.sin(Math.PI / 6 + 0.01) },
			"right",
			false,
		),
	).toBe(false);
});
