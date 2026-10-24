// @vitest-environment node
import { expect, it } from "vitest";
import type { FootCycle } from "../core/characters/footLock";
import { simulateWalks } from "./runner";
import type { SceneRecord } from "./types";

it("runs a continuous walk to completion without retired planner output", async () => {
	const sheet: FootCycle = {
		name: "walk",
		frameWidth: 100,
		frameHeight: 200,
		fps: 2,
		switchFrames: [0, 1],
		contacts: [
			{ planted: "L", L: { x: 40, y: 200 }, R: { x: 60, y: 200 } },
			{ planted: "R", L: { x: 60, y: 200 }, R: { x: 40, y: 200 } },
		],
	};
	const scene: SceneRecord = {
		location: "room",
		area: {
			mask: { width: 8, height: 8, data: Array(64).fill(1) },
			perspective: { horizonY: 0, slope: 0.001, pixelsPerMetre: 100 },
			baseScale: 1,
			scaleClamp: { min: 0.1, max: 2 },
		},
		exits: [],
		objects: [],
		interactables: [],
		layers: [],
		connections: [],
	};
	const saved = new Map<string, unknown>();
	const report = await simulateWalks({
		scenes: {
			room: {
				location: "room",
				plan: {
					beats: [{ name: "across", start: [840, 607.5], click: [1320, 607] }],
				},
			},
		},
		sheets: () => sheet,
		animation: (cycle, current, show) => ({
			current,
			show,
			select: () => ({ cycle: cycle("walk"), flipX: false }),
		}),
		initialTexture: "walk",
		loadWalkRecords: () => scene,
		storedOptions: () => [],
		Fade: class {
			isRunning = false;
			update() {}
			start() {}
		},
		save: (path, value) => {
			saved.set(path, value);
		},
	});
	expect(report.walks).toBe(1);
	expect(report.results[0].arrival?.anchor).toEqual({ x: 1320, y: 607 });
	expect(saved.get("/room/across-events.json")).toMatchObject({
		completed: true,
		limitations: [],
	});
	const rows = saved.get("/room/across.json") as {
		walking: boolean;
		contact: Record<string, unknown> & { anchor: { x: number }; plan: object };
	}[];
	const walking = rows.filter((row) => row.walking);
	expect(walking.length).toBeGreaterThan(2);
	for (let i = 1; i < walking.length; i++)
		expect(walking[i].contact.anchor.x).toBeGreaterThan(
			walking[i - 1].contact.anchor.x,
		);
	for (const row of rows) {
		for (const field of ["cut", "settling", "drawn", "transition", "planted"])
			expect(row.contact).not.toHaveProperty(field);
		expect(row.contact.plan).not.toHaveProperty("search");
	}
	expect([...saved.keys()].some((path) => path.includes("rejections"))).toBe(
		false,
	);
	expect(report.results[0]).not.toHaveProperty("searches");
});
