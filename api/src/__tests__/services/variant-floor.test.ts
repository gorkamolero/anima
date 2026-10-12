// @vitest-environment node
import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ difference: vi.fn(), floor: vi.fn() }));
vi.mock("node:child_process", () => ({ execFileSync: mocks.difference }));
vi.mock("../../services/occluders.js", () => ({ cachedFloor: mocks.floor }));
vi.mock("../../lib/backgrounds.js", () => ({
	imagePath: (path: string) => path,
}));

import { unchangedAnchorFloor } from "../../services/variant-floor.js";

it("keeps only unchanged segmented floor after an image edit", async () => {
	mocks.floor.mockResolvedValue({ width: 2, height: 2, data: [1, 1, 0, 1] });
	mocks.difference.mockReturnValue(Buffer.from([0, 255, 0, 0]));
	expect((await unchangedAnchorFloor("edited", "anchor"))?.data).toEqual([
		1, 0, 0, 1,
	]);
});
it("does not invent floor when the source segmentation is missing", async () => {
	mocks.floor.mockResolvedValue(undefined);
	expect(await unchangedAnchorFloor("edited", "anchor")).toBeUndefined();
});
