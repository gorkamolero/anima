// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	derive: vi.fn(),
	judge: vi.fn(),
	floorJudge: vi.fn(),
	occlude: vi.fn(),
	rows: new Map<string, string>(),
}));
vi.mock("node:fs/promises", async (importOriginal) => ({
	...(await importOriginal<typeof import("node:fs/promises")>()),
	writeFile: vi.fn(),
}));
vi.mock("../../services/ground.js", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../services/ground.js")>()),
	deriveGround: mocks.derive,
	judgeGround: mocks.judge,
	judgeFloorOverlay: mocks.floorJudge,
}));
vi.mock("../../services/ground-overlay.js", () => ({
	groundOverlay: vi.fn(async () => "/proof/overlay.png"),
	groundMaskReview: vi.fn(async () => "/proof/mask.png"),
}));
vi.mock("../../services/occluders.js", () => ({
	deriveOccluders: mocks.occlude,
	reserveSegmentation: vi.fn(),
}));
vi.mock("../../services/world.js", () => ({
	defaultVisual: () => ({}),
	getWorldDb: async () => ({
		execute: async (q: string | { sql: string; args: string[] }) => {
			if (typeof q === "string")
				return { rows: [...mocks.rows.values()].map((data) => ({ data })) };
			if (q.sql.startsWith("INSERT")) {
				mocks.rows.set(q.args[0], q.args[1]);
				return { rows: [] };
			}
			return {
				rows: mocks.rows.has(q.args[0])
					? [{ data: mocks.rows.get(q.args[0]) }]
					: [],
			};
		},
	}),
}));
vi.mock("../../routes/interactables.js", () => ({
	interactablesRoutes: { request: async () => new Response("{}") },
}));
vi.mock("../../routes/scene-image.js", () => ({
	sceneImageRoutes: {
		request: async () =>
			Response.json({ url: "http://localhost/generated/cached.png" }),
	},
}));

vi.mock("../../services/floor-judge.js", () => ({
	labelledFloorObjects: async () => [],
	locateFloorHazards: async () => {},
}));
vi.mock("../../services/ground-repair.js", () => ({
	repairGround: vi.fn(() => false),
}));

import { findPath } from "@anima/footfall/core/walkarea/navigation";
import { placesRoutes } from "../../routes/places.js";
import { maskToGround } from "../../services/ground.js";

const request = () =>
	placesRoutes.request("http://localhost/places", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			parent: "inside",
			to: "new-room",
			template: "interior",
			description: "New room",
		}),
	});
beforeEach(() => {
	vi.clearAllMocks();
	mocks.rows.clear();
	mocks.floorJudge.mockResolvedValue({
		pass: true,
		why: "floor plausible",
		overlay: "mask.png",
	});
	mocks.occlude.mockResolvedValue({ occluders: [], exits: [] });
	mocks.judge.mockResolvedValue([{ pass: true, why: "plausible" }]);
});
describe("place ground failure contract", () => {
	it("persists segmentation failures, excludes them from travel, and returns a diagnostic lookup", async () => {
		mocks.derive.mockRejectedValue(new Error("No reliable floor"));
		const response = await request();
		expect(response.status).toBe(200);
		const place = await response.json();
		expect(place.ground.ground).toBe("failed");
		expect(place.ground.reason).toBe("No reliable floor");
		expect(mocks.rows.size).toBe(1);
		expect(mocks.occlude).not.toHaveBeenCalled();
		expect(
			await (await placesRoutes.request("http://localhost/places")).json(),
		).toEqual([]);
		expect(
			(await placesRoutes.request(`http://localhost/places/${place.id}`))
				.status,
		).toBe(409);
		expect(
			await (
				await placesRoutes.request("http://localhost/places?includeFailed=true")
			).json(),
		).toHaveLength(1);
	});
	it("persists incomplete occlusion as failed instead of losing the created place", async () => {
		mocks.derive.mockResolvedValue(
			maskToGround(
				{
					width: 40,
					height: 40,
					data: Array.from({ length: 1600 }, (_, i) => (i >= 800 ? 1 : 0)),
				},
				300,
				0.002,
			),
		);
		mocks.occlude.mockRejectedValue(new Error("Provider unavailable"));
		const place = await (await request()).json();
		expect(place.ground.ground).toBe("failed");
		expect(place.ground.reason).toContain("Provider unavailable");
		expect(mocks.rows.size).toBe(1);
	});
});

it("rejects false walkable even when placement checks would pass", async () => {
	mocks.derive.mockResolvedValue(
		maskToGround(
			{
				width: 40,
				height: 40,
				data: Array.from({ length: 1600 }, (_, i) => (i >= 800 ? 1 : 0)),
			},
			300,
			0.002,
		),
	);
	mocks.floorJudge.mockResolvedValue({
		pass: false,
		why: "water included",
		overlay: "mask.png",
	});
	const place = await (await request()).json();
	expect(place.ground.ground).toBe("failed");
	expect(place.ground.reason).toContain("water included");
	expect(place.ground.floor.data.some(Boolean)).toBe(false);
	expect(place.ground.verdicts).toHaveLength(1);
});
it("accepts conservative coverage and does not rederive existing places after a version change", async () => {
	mocks.derive.mockResolvedValue(
		maskToGround(
			{
				width: 40,
				height: 40,
				data: Array.from({ length: 1600 }, (_, i) => (i >= 800 ? 1 : 0)),
			},
			300,
			0.002,
		),
	);
	mocks.floorJudge.mockResolvedValue({
		pass: true,
		why: "safe",
		probabilities: { coverage: 0.2 },
		overlay: "mask.png",
	});
	const place = await (await request()).json();
	expect(place.ground.ground).toBe("derived");
	expect(place.ground.notes.join(" ")).toContain("missing floor does not reject");
	place.ground.derivationVersion = -100;
	mocks.rows.set(place.id, JSON.stringify(place));
	const loaded = await placesRoutes.request(
		`http://localhost/places/${place.id}`,
	);
	expect(loaded.status).toBe(200);
	const old = await loaded.json();
	expect(old.ground.derivationVersion).toBe(-100);
	expect(
		findPath(old.ground.floor, { x: 400, y: 800 }, { x: 1400, y: 800 }).length,
	).toBeGreaterThan(1);
	await request();
	expect(mocks.derive).toHaveBeenCalledTimes(1);
	const refreshed = await placesRoutes.request(
		`http://localhost/places/${place.id}/rederive`,
		{ method: "POST" },
	);
	expect(refreshed.status).toBe(200);
	expect(mocks.derive).toHaveBeenCalledTimes(2);
	expect((await refreshed.json()).id).toBe(place.id);
	mocks.derive.mockRejectedValueOnce(new Error("Replacement failed"));
	await placesRoutes.request(`http://localhost/places/${place.id}/rederive`, {
		method: "POST",
	});
	expect(
		(
			await (
				await placesRoutes.request(`http://localhost/places/${place.id}`)
			).json()
		).ground.ground,
	).toBe("derived");
});

it.each([
	15, 16,
])("guards a %i percent floor loss on refresh and retains review overlays", async (percent) => {
	const initial = maskToGround(
		{
			width: 40,
			height: 40,
			data: Array.from({ length: 1600 }, (_, i) => (i >= 800 ? 1 : 0)),
		},
		300,
		0.002,
	);
	mocks.derive.mockResolvedValueOnce(initial);
	const place = await (await request()).json();
	const next = structuredClone(initial);
	let remaining = (800 * percent) / 100;
	next.floor.data = next.floor.data.map((v) => (v && remaining-- > 0 ? 0 : v));
	mocks.derive.mockResolvedValueOnce(next);
	const refreshed = await (
		await placesRoutes.request(`http://localhost/places/${place.id}/rederive`, {
			method: "POST",
		})
	).json();
	const persisted = JSON.parse(mocks.rows.get(place.id) ?? "null");
	expect(refreshed.ground.floor.data.filter(Boolean).length).toBe(
		percent > 15 ? 800 : 680,
	);
	expect(persisted.ground.floor).toEqual(refreshed.ground.floor);
	if (percent > 15) {
		const { writeFile } = await import("node:fs/promises");
		expect(
			vi
				.mocked(writeFile)
				.mock.calls.some(
					([, body]) =>
						String(body).includes('"status":"review-required"') &&
						String(body).includes('"overlays"'),
				),
		).toBe(true);
	}
});

it("installs an explicit reviewer replacement while preserving judge disagreement", async () => {
	const { replaceReviewedPlace } = await import("../../routes/places.js");
	const initial = maskToGround(
		{ width: 40, height: 40, data: Array(1600).fill(1) },
		300,
		0.002,
	);
	mocks.derive.mockResolvedValue(initial);
	const previous = await (await request()).json();
	const candidate = structuredClone(previous);
	candidate.ground.floor.data[0] = 0;
	candidate.ground.verdicts = [
		{
			pass: false,
			why: "Global obstacle disagreement",
			probabilities: { obstacles: 1, object_0: 0 },
		},
	];
	const review = {
		approvedBy: "reviewer" as const,
		date: "2026-10-12",
		overlay: new URL(
			"../../../../packages/footfall/derive/exits.test.ts",
			import.meta.url,
		).pathname,
		judgeDisagreement: candidate.ground.verdicts,
	};
	await expect(
		replaceReviewedPlace(
			previous.id,
			{ ...candidate, background: "/wrong.png" },
			review,
		),
	).rejects.toThrow("mismatch");
	await replaceReviewedPlace(previous.id, candidate, review);
	const loaded = await (
		await placesRoutes.request(`http://localhost/places/${previous.id}`)
	).json();
	expect(loaded.ground).toEqual(candidate.ground);
	expect(mocks.derive).toHaveBeenCalledTimes(1);
	const { writeFile } = await import("node:fs/promises");
	expect(
		vi
			.mocked(writeFile)
			.mock.calls.some(
				([, body]) =>
					String(body).includes('"approvedBy":"reviewer"') &&
					String(body).includes('"status":"complete"') &&
					String(body).includes('"overlaySha256"'),
			),
	).toBe(true);
});
