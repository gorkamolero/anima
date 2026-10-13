import type { Exit } from "@anima/footfall";
import { describe, expect, it } from "vitest";
import { narrativeDeparture } from "./worldGeometry";

describe("narrative travel preserves physical connections", () => {
	const far: Exit = {
		id: "far",
		kind: "far",
		to: "canonical-alley",
		region: [],
	};
	it("does not reuse the canonical alley exit for a different narrated alley", () => {
		expect(narrativeDeparture([far], "narrated-alley", "far")).toBeUndefined();
		expect(far.to).toBe("canonical-alley");
	});
	it("uses an existing destination connection even on another edge", () => {
		const side: Exit = {
			id: "left",
			kind: "edge-left",
			to: "road",
			region: [],
		};
		expect(narrativeDeparture([far, side], "road", "far")).toBe(side);
	});
	it("can establish travel through an unconnected default exit", () => {
		const free: Exit = { id: "far-free", kind: "far", region: [] };
		expect(narrativeDeparture([far, free], "new-place", "far")).toBe(free);
	});
});
