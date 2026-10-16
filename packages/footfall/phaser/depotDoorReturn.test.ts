// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { FootCycle } from "../core/characters/footLock";
import { CharacterMotor, type MotorPlanRequest } from "./CharacterMotor";
import capturedFixture from "./fixtures/depot-door-return.json";

describe("returning to the depot", () => {
	it("reaches the door after an obstacle turn without relaxing arrival", () => {
		// Captured from the browser after walking depot -> road -> alley -> depot.
		// The previous planner exhausted its work allowance and left this click idle outside.
		const fixture = JSON.parse(JSON.stringify(capturedFixture));
		for (const mask of Object.values(fixture.request.area)) {
			if (mask && typeof mask === "object" && "runs" in mask) {
				const encoded = mask as { runs: [number, number][]; data: number[] };
				encoded.data = encoded.runs.flatMap(([value, count]) =>
					Array(count).fill(value),
				);
			}
		}
		for (const pose of [
			fixture.request.pose,
			...Object.values(fixture.request.cycles),
			...Object.values(fixture.request.standing),
		]) {
			const encoded = pose as { cycle: string | FootCycle };
			encoded.cycle = fixture.cycleData[encoded.cycle as string];
		}
		const result = CharacterMotor.computePlan(
			fixture.request as MotorPlanRequest,
		);
		expect(result.complete).toBe(true);
		expect(result.stats.reason).toBe("complete");
	});
});
