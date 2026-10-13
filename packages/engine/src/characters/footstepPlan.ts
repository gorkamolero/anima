import {
	type Perspective,
	type Point,
	toMetres,
} from "../walkarea/perspective";
import { headingFromGround, type WalkDirection } from "./walkHeading";

export interface WalkLeg {
	from: Point;
	to: Point;
	heading: WalkDirection;
	corner: boolean;
}
/** Choose directions once from the string-pulled route, never from pose offsets. */
export function walkLegs(
	path: readonly Point[],
	perspective: Perspective,
): WalkLeg[] {
	const legs: WalkLeg[] = [];
	let previousAngle: number | undefined;
	for (let i = 1; i < path.length; i++) {
		const from = path[i - 1],
			to = path[i];
		if (Math.hypot(to.x - from.x, to.y - from.y) < 1e-6) continue;
		const a =
			perspective.constant === undefined
				? toMetres(perspective, from)
				: { x: from.x, y: -from.y };
		const b =
			perspective.constant === undefined
				? toMetres(perspective, to)
				: { x: to.x, y: -to.y };
		const angle = Math.atan2(b.y - a.y, b.x - a.x);
		const turn =
			previousAngle === undefined
				? 0
				: Math.abs(
						Math.atan2(
							Math.sin(angle - previousAngle),
							Math.cos(angle - previousAngle),
						),
					);
		const corner = turn > (25 * Math.PI) / 180;
		const previous = legs[legs.length - 1];
		const heading =
			previous && !corner
				? previous.heading
				: headingFromGround(
						b.x - a.x,
						b.y - a.y,
						previous?.heading,
						perspective.constant === undefined
							? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
							: { x: 0, y: 1 },
						0,
					);
		legs.push({ from, to, heading, corner });
		previousAngle = angle;
	}
	return legs;
}

export interface PlannedStep<State, Pose> {
	heading: WalkDirection;
	pose: Pose;
	state: State;
	stop: boolean;
	leg: number;
	slide: Point;
}
export interface StepSimulation<State, Pose> {
	position(state: State): Point;
	offset?(state: State, slide: Point): State;
	entry(
		state: State,
		heading: WalkDirection,
		starting: boolean,
	): Pose | undefined;
	advance(state: State, pose: Pose): State | undefined;
	/** Safe exit plus every settle frame. Returns the final rest sole. */
	rest(state: State, pose: Pose, heading: WalkDirection): Point | undefined;
}
/** Enumerate whole drawn strides before playback. Search backwards through safe
 * stop candidates for the nearest rest sole; a blocked settle selects an earlier
 * stride. No direction search, overshoot correction, or runtime replanning. */
function simulatePlan<State, Pose>(
	legs: readonly WalkLeg[],
	initial: State,
	sim: StepSimulation<State, Pose>,
	corrections: readonly Point[] = [],
) {
	const steps: PlannedStep<State, Pose>[] = [];
	let state = initial;
	let bestStop:
		| { steps: PlannedStep<State, Pose>[]; distance: number }
		| undefined;
	const target = legs[legs.length - 1]?.to;
	if (!target) return { steps, distance: 0, complete: true };
	for (let legIndex = 0; legIndex < legs.length; legIndex++) {
		const leg = legs[legIndex];
		const candidates: {
			state: State;
			steps: PlannedStep<State, Pose>[];
			distance: number;
		}[] = [];
		let previousDistance = Infinity;
		for (let stride = 0; stride < 256; stride++) {
			const slide = steps.length
				? (corrections[legIndex] ?? { x: 0, y: 0 })
				: { x: 0, y: 0 };
			if (sim.offset) state = sim.offset(state, slide);
			const pose = sim.entry(state, leg.heading, steps.length === 0);
			if (!pose) break;
			const node = {
				heading: leg.heading,
				pose,
				state,
				stop: false,
				leg: legIndex,
				slide,
			};
			const rest = sim.rest(state, pose, leg.heading);
			if (rest) {
				const distance = Math.hypot(rest.x - target.x, rest.y - target.y);
				if (!bestStop || distance < bestStop.distance)
					bestStop = { steps: [...steps, { ...node, stop: true }], distance };
			}
			const next = sim.advance(state, pose);
			if (!next) break;
			const p = sim.position(next),
				before = sim.position(state);
			const progress =
				(p.x - before.x) * (leg.to.x - leg.from.x) +
				(p.y - before.y) * (leg.to.y - leg.from.y);
			if (steps.length > 0 && progress <= 1e-6) break;
			const distance = Math.hypot(p.x - leg.to.x, p.y - leg.to.y);
			steps.push(node);
			candidates.push({ state: next, steps: [...steps], distance });
			state = next;
			// Include the first overshooting stride so both adjacent whole strides
			// compete. Never execute a reverse stride to recover from the overshoot.
			if (distance > previousDistance) break;
			previousDistance = distance;
		}
		if (legIndex < legs.length - 1) {
			const nextHeading = legs[legIndex + 1].heading;
			const selected = candidates
				.sort((a, b) => a.distance - b.distance)
				.find((c) => {
					const entry = sim.entry(c.state, nextHeading, false);
					return (
						entry !== undefined && sim.advance(c.state, entry) !== undefined
					);
				});
			if (!selected) break;
			state = selected.state;
			steps.splice(0, steps.length, ...selected.steps);
		}
	}
	return {
		steps: bestStop?.steps ?? [],
		distance: bestStop?.distance ?? Infinity,
		complete: Boolean(bestStop),
	};
}

/** Distribute the leg's lateral residual equally across its supports, with a
 * strict subpixel bound. Resimulate all landings and settles after correction. */
export function planFootsteps<State, Pose>(
	legs: readonly WalkLeg[],
	initial: State,
	sim: StepSimulation<State, Pose>,
) {
	const first = simulatePlan(legs, initial, sim);
	if (!sim.offset) return first;
	const corrections = legs.map((leg, i) => {
		const steps = first.steps.filter((s) => s.leg === i);
		if (steps.length < 2) return { x: 0, y: 0 };
		const p = sim.position(steps[steps.length - 1].state);
		const dx = leg.to.x - leg.from.x,
			dy = leg.to.y - leg.from.y;
		const length = Math.hypot(dx, dy);
		const nx = -dy / length,
			ny = dx / length;
		const error =
			((leg.to.x - p.x) * nx + (leg.to.y - p.y) * ny) / steps.length;
		const amount = Math.max(-0.9, Math.min(0.9, error));
		return { x: nx * amount, y: ny * amount };
	});
	const corrected = simulatePlan(legs, initial, sim, corrections);
	return corrected.distance <= first.distance ? corrected : first;
}
