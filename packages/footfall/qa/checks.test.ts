import { describe, expect, it } from "vitest";
import type { FootCycle } from "../core/characters/footLock";
import {
	checkArrival,
	checkExits,
	checkFacing,
	checkFloor,
	checkFootLock,
	checkFrozenFrames,
	checkScale,
	type FrameLog,
} from "./checks";

const sheet: FootCycle = {
	name: "test",
	frameWidth: 100,
	frameHeight: 200,
	fps: 24,
	switchFrames: [0],
	contacts: [{ planted: "L", L: { x: 50, y: 200 }, R: { x: 60, y: 200 } }],
};
const metadata = () => sheet;
const area = {
	mask: { width: 2, height: 2, data: [0, 0, 1, 1] },
	perspective: { horizonY: 0, slope: 0.001 },
	baseScale: 1,
	scaleClamp: { min: 0, max: 10 },
};
const row = (x = 960): FrameLog => ({
	x,
	y: 810,
	scale: 0.81,
	texture: "test",
	frame: 0,
	flip: false,
	visible: true,
	walking: false,
	location: "room",
	contact: {
		heading: "away",
		planted: "L",
		anchor: { x, y: 810 },
		ground: { x: 0, y: 5 },
	},
});
describe("reviewer log-check ports", () => {
	it("measures physical foot drift even when reported anchors stay fixed", () => {
		const rows = [row(), row(962), row(964)];
		rows.forEach((r) => {
			r.contact.anchor = { x: 960, y: 810 };
		});
		expect(checkFootLock(rows, metadata).maxExcursion_px).toBe(4);
		expect(checkFootLock(rows, metadata).pass).toBe(false);
	});
	it("keeps a continuous physical support across a standing texture cut", () => {
		const rows = [row(), { ...row(), texture: "standing" }, row()];
		expect(checkFootLock(rows, metadata)).toMatchObject({
			stances: 1,
			maxExcursion_px: 0,
			pass: true,
		});
	});
	it("checks raw floor and independent object footprints", () => {
		expect(checkFloor([row()], { area }, metadata).pass).toBe(true);
		expect(
			checkFloor([{ ...row(), y: 100 }], { area }, metadata).offFloor,
		).toEqual([0]);
		expect(
			checkFloor(
				[row()],
				{
					area: {
						...area,
						objectFootprints: { ...area.mask, data: [1, 1, 1, 1] },
					},
				},
				metadata,
			).objectContacts,
		).toEqual([0]);
	});
	it("rejects corrupted scale", () => {
		expect(checkScale([row()], { area }).pass).toBe(true);
		expect(checkScale([{ ...row(), scale: 1 }], { area }).pass).toBe(false);
	});
	it("judges heading per stance rather than a single bobbing frame", () => {
		const make = (dx: number, dy: number) =>
			Array.from({ length: 36 }, (_, i) => ({
				...row(),
				walking: true,
				contact: {
					...row().contact,
					planted: (Math.floor(i / 6) % 2 ? "R" : "L") as "L" | "R",
					anchor: { x: Math.floor(i / 6) * 10, y: 810 },
					ground: { x: dx * i, y: 5 + dy * i },
				},
			}));
		expect(checkFacing(make(0, 0.03)).pass).toBe(true);
		expect(checkFacing(make(0.03, 0)).pass).toBe(false);
	});
	it("measures arrival at nearest standable cell", () => {
		const r = row();
		r.contact.arrival = {
			target: { x: 480, y: 100 },
			anchor: { x: 480, y: 810 },
			halfStride: 50,
		};
		expect(checkArrival([r], { area }).status).toBe("half");
	});
	it("rejects duplicate or wrong-destination exit triggers", () => {
		const event = { type: "triggerExit", data: { id: "door", to: "hall" } };
		expect(checkExits([event], "door", "hall").pass).toBe(true);
		expect(checkExits([event, event], "door", "hall").pass).toBe(false);
		expect(checkExits([event], "door", "street").pass).toBe(false);
	});
	it("checks frozen rendered frames only while walking", () => {
		expect(
			checkFrozenFrames(["a", "a", "b"], [true, true, true]).flagged,
		).toEqual([1]);
		expect(checkFrozenFrames(["a", "a"], [false, false]).pass).toBe(true);
	});
});
