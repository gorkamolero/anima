import { describe, expect, it } from "vitest";
import { REVIEW_SCENES } from "../../../../adventures/shadow-over-innsmouth/src/game/scenes/standaloneScenes";
import { walkAreaFromAnchor } from "./anchor";
import { cellPoint, findPath } from "./navigation";
import { scaleAt } from "./perspective";

describe("anchor walk area", () => {
	for (const scene of Object.values(REVIEW_SCENES))
		it(`${scene.id} preserves authored scales and stops before captions`, () => {
			const area = walkAreaFromAnchor(scene, {
				horizonY: scene.id === "outside" ? 470 : undefined,
			});
			for (const p of scene.groundLine.points)
				expect(
					Math.abs(scaleAt(area.perspective, p) / (p.scaleFactor ?? 1) - 1),
				).toBeLessThan(0.01);
			for (let i = 0; i < area.mask.data.length; i++)
				if (area.mask.data[i])
					expect(cellPoint(area.mask, i).y).toBeLessThanOrEqual(944);
		});
	it("does not connect the separated exterior bands", () => {
		const a = walkAreaFromAnchor(REVIEW_SCENES.outside, { horizonY: 470 });
		const path = findPath(a.mask, { x: 350, y: 900 }, { x: 1400, y: 900 });
		expect(path.at(-1)?.x).toBeLessThan(760);
	});
});
