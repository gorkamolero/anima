// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { FootCycle } from "../core/characters/footLock";
import { CharacterMotor, type MotorPlanRequest } from "./CharacterMotor";
import capturedFixture from "./fixtures/road-detour.json";

describe("road obstacle detour", () => {
	it("reaches the far side of foreground obstacles within the shared search budget", () => {
		// Captured from the production headless motor on the road near-left click.
		// Navigation-only search stopped over two strides short of a valid target.
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
		expect(result.stats.expanded).toBeLessThanOrEqual(8000);
	});
});
