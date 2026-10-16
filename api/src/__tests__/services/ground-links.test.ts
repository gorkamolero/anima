// @vitest-environment node
import { expect, it } from "vitest";
import { connectedFloorLinks } from "../../services/ground-links.js";

it("keeps connections that turn around an occluder, without linking an isolated pocket", () => {
	const width = 18,
		height = 12,
		nav = { width, height, data: Array<number>(width * height).fill(0) },
		visible = { ...nav, data: [...nav.data] };
	for (let y = 3; y <= 8; y++)
		for (const x of [1, 2, 12, 13]) nav.data[y * width + x] = 1;
	for (let x = 1; x <= 13; x++) nav.data[3 * width + x] = 1;
	for (let y = 7; y <= 8; y++)
		for (const x of [1, 2, 12, 13]) visible.data[y * width + x] = 1;
	visible.data[width + 16] = nav.data[width + 16] = 1;
	const links = connectedFloorLinks(nav, visible);
	expect(links).toHaveLength(1);
	expect(links[0].from.x).toBeLessThan(400);
	expect(links[0].to.x).toBeGreaterThan(1200);
	for (const p of [links[0].from, links[0].to])
		expect(
			visible.data[
				Math.floor((p.y * height) / 1080) * width +
					Math.floor((p.x * width) / 1920)
			],
		).toBe(1);
});
