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
	headings?(leg: WalkLeg): readonly WalkDirection[];
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
	const target = legs[legs.length - 1]?.to;
	if (!target)
		return {
			steps: [] as PlannedStep<State, Pose>[],
			distance: 0,
			complete: true,
		};
	type Branch = {
		state: State;
		steps: PlannedStep<State, Pose>[];
		distance: number;
	};
	let beam: Branch[] = [{ state: initial, steps: [], distance: 0 }];
	let bestStop:
		| { steps: PlannedStep<State, Pose>[]; distance: number; remaining: number }
		| undefined;
	for (let legIndex = 0; legIndex < legs.length; legIndex++) {
		const leg = legs[legIndex];
		const tail = legs
			.slice(legIndex + 1)
			.reduce(
				(sum, l) => sum + Math.hypot(l.to.x - l.from.x, l.to.y - l.from.y),
				0,
			);
		const candidates: Branch[] = [];
		for (const branch of beam) {
			const previousHeading = branch.steps[branch.steps.length - 1]?.heading;
			const headings =
				previousHeading && !leg.corner
					? [previousHeading]
					: (sim.headings?.(leg) ?? [leg.heading]);
			for (const heading of headings) {
				let state = branch.state;
				const steps = [...branch.steps];
				let previousDistance = Infinity,
					growing = 0;
				for (let stride = 0; stride < 256; stride++) {
					const slide = steps.length
						? (corrections[legIndex] ?? { x: 0, y: 0 })
						: { x: 0, y: 0 };
					if (sim.offset) state = sim.offset(state, slide);
					const pose = sim.entry(state, heading, steps.length === 0);
					if (!pose) break;
					const node = {
						heading,
						pose,
						state,
						stop: false,
						leg: legIndex,
						slide,
					};
					const rest = sim.rest(state, pose, heading);
					if (rest) {
						const distance = Math.hypot(rest.x - target.x, rest.y - target.y);
						const remaining =
							Math.hypot(rest.x - leg.to.x, rest.y - leg.to.y) + tail;
						if (!bestStop || remaining < bestStop.remaining)
							bestStop = {
								steps: [...steps, { ...node, stop: true }],
								distance,
								remaining,
							};
					}
					const next = sim.advance(state, pose);
					if (!next) break;
					const p = sim.position(next);
					const distance = Math.hypot(p.x - leg.to.x, p.y - leg.to.y);
					steps.push(node);
					if (legIndex < legs.length - 1) {
						const following = legs[legIndex + 1];
						const valid = (
							following.corner
								? (sim.headings?.(following) ?? [following.heading])
								: [heading]
						).some((direction) => {
							const entry = sim.entry(next, direction, false);
							return (
								entry !== undefined && sim.advance(next, entry) !== undefined
							);
						});
						if (valid)
							candidates.push({ state: next, steps: [...steps], distance });
					}
					state = next;
					growing = distance > previousDistance ? growing + 1 : 0;
					if (growing >= 2) break;
					previousDistance = distance;
				}
			}
		}
		// Retain several whole-stride corners: the closest drawing may have no
		// safe next settle even though its first stance fits. Search ahead now,
		// never after the character has arrived at that corner.
		beam = candidates.sort((a, b) => a.distance - b.distance).slice(0, 12);
		if (!beam.length) break;
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
