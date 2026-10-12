// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	files: new Map<string, string>(),
	writes: [] as { path: string; body: string }[],
}));
vi.mock("../../lib/backgrounds.js", () => ({
	ROOT: "/test",
	imagePath: (image: string) => image,
}));
vi.mock("node:fs/promises", () => ({
	mkdir: vi.fn(async () => {}),
	readFile: vi.fn(async (path: string) => {
		if (state.files.has(path)) return state.files.get(path);
		if (path.endsWith(".png")) return Buffer.from(path);
		if (path.includes("-floor-v"))
			return JSON.stringify({ mask: { width: 2, height: 1, data: [1, 0] } });
		throw new Error("Missing fixture");
	}),
	writeFile: vi.fn(async (path: string, body: string) => {
		state.files.set(path, body);
		state.writes.push({ path, body });
	}),
	readdir: vi.fn(async () => []),
}));

import {
	cachedFloor,
	replaceReviewedAnchorFloor,
} from "../../services/occluders.js";

const review = {
	approvedBy: "reviewer" as const,
	date: "2026-10-12",
	overlays: ["/close.png", "/candidate.png"],
	judgeDisagreement: { environment: 1, pass: false },
};
beforeEach(() => {
	state.files.clear();
	state.writes = [];
});
it("persists the approved anchor floor and both hashed overlays without changing the verdict", async () => {
	const floor = { width: 2, height: 1, data: [1, 1] };
	const audit = await replaceReviewedAnchorFloor("/dock.png", floor, review);
	expect(await cachedFloor("/dock.png")).toEqual(floor);
	const record = JSON.parse(state.files.get(audit) as string);
	expect(record).toMatchObject({
		...review,
		overlays: review.overlays.map((path) => ({
			path,
			sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
		})),
		previous: { width: 2, height: 1, data: [1, 0] },
		candidate: floor,
		status: "complete",
	});
	expect(JSON.parse(state.writes[0].body).status).toBe("started");
});
it("rejects invalid approval or floor before writing", async () => {
	await expect(
		replaceReviewedAnchorFloor(
			"/dock.png",
			{ width: 2, height: 1, data: [1] },
			review,
		),
	).rejects.toThrow("Invalid");
	await expect(
		replaceReviewedAnchorFloor(
			"/dock.png",
			{ width: 2, height: 1, data: [1, 1] },
			{ ...review, date: "invalid" },
		),
	).rejects.toThrow("Invalid");
	expect(state.writes).toHaveLength(0);
});
