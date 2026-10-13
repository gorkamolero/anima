import {
	type SearchOptions,
	type StepSimulation,
	planFootsteps as search,
} from "../core/characters/footstepPlan";
import type { Point } from "../core/walkarea/perspective";

export type { SearchOptions } from "../core/characters/footstepPlan";
/** Preserve the original default clock at the platform boundary. */
export function planFootsteps<State, Pose>(
	target: Point,
	initial: State,
	sim: StepSimulation<State, Pose>,
	options: SearchOptions = {},
) {
	return search(target, initial, sim, {
		...options,
		now: options.now ?? (() => performance.now()),
	});
}
