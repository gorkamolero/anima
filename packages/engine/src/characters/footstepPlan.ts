import {
	type Perspective,
	type Point,
	toMetres,
} from "../walkarea/perspective";
import {
	GROUND_SECTORS,
	headingFromGround,
	type WalkDirection,
} from "./walkHeading";

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
	ground?(point: Point): Point;
	native?(state: State, heading: WalkDirection): Point | undefined;
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
			const origin = sim.position(branch.state);
			const ground = sim.ground ?? ((p: Point) => p);
			const g = ground(origin),
				t = ground(leg.to);
			const desired = Math.atan2(t.y - g.y, t.x - g.x);
			// Measure the native direction from actual locked-foot landings.
			const directions = (sim.headings?.(leg) ?? GROUND_SECTORS).flatMap(
				(heading) => {
					let endpoint = sim.native?.(branch.state, heading);
					if (!endpoint) {
						const pose = sim.entry(
							branch.state,
							heading,
							branch.steps.length === 0,
						);
						const next =
							pose === undefined ? undefined : sim.advance(branch.state, pose);
						if (!next) return [];
						const continuation = sim.entry(next, heading, false);
						const landing =
							continuation === undefined
								? undefined
								: sim.advance(next, continuation);
						endpoint = sim.position(landing ?? next);
					}
					const p = ground(endpoint);
					const angle = Math.atan2(p.y - g.y, p.x - g.x);
					const error = Math.atan2(
						Math.sin(angle - desired),
						Math.cos(angle - desired),
					);
					return [{ heading, error }];
				},
			);
			const close = directions.filter((d) => Math.abs(d.error) <= Math.PI / 36);
			const low = directions
				.filter((d) => d.error < 0)
				.sort((a, b) => b.error - a.error)[0];
			const high = directions
				.filter((d) => d.error >= 0)
				.sort((a, b) => a.error - b.error)[0];
			const orders: WalkDirection[][] = close.length
				? close.map((d) => [d.heading])
				: low && high && high.error - low.error < Math.PI
					? [
							[low.heading, high.heading],
							[high.heading, low.heading],
						]
					: directions
							.filter((d) => Math.abs(d.error) < Math.PI / 2)
							.map((d) => [d.heading]);
			if (
				!orders.some(
					([heading]) =>
						sim.entry(branch.state, heading, branch.steps.length === 0) !==
						undefined,
				)
			) {
				// A standing drawing can be blocked even when the route centre fits.
				// Use a forward native departure; the midpoint search plans its turn.
				orders.push(
					...directions
						.filter((d) => Math.abs(d.error) < Math.PI / 2)
						.map((d) => [d.heading]),
				);
			}

			const run = (
				state: State,
				prefix: PlannedStep<State, Pose>[],
				heading: WalkDirection,
				visit: (s: State, steps: PlannedStep<State, Pose>[]) => void,
			) => {
				const steps = [...prefix];
				let previousDistance = Infinity,
					growing = 0;
				for (let stride = 0; stride < 128; stride++) {
					const slide = steps.length
						? (corrections[legIndex] ?? { x: 0, y: 0 })
						: { x: 0, y: 0 };
					if (sim.offset) state = sim.offset(state, slide);
					const pose = sim.entry(state, heading, steps.length === 0);
					if (pose === undefined) break;
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
					steps.push(node);
					visit(next, [...steps]);
					const p = sim.position(next);
					const distance = Math.hypot(p.x - leg.to.x, p.y - leg.to.y);
					state = next;
					growing = distance > previousDistance ? growing + 1 : 0;
					if (growing >= 2) break;
					previousDistance = distance;
				}
			};
			const retain = (state: State, steps: PlannedStep<State, Pose>[]) => {
				const p = sim.position(state);
				candidates.push({
					state,
					steps,
					distance: Math.hypot(p.x - leg.to.x, p.y - leg.to.y),
				});
			};
			for (const [first, second] of orders) {
				run(branch.state, branch.steps, first, (state, steps) => {
					retain(state, steps);
					if (second) run(state, steps, second, retain);
				});
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
	let first = simulatePlan(legs, initial, sim);
	const last = first.steps[first.steps.length - 1];
	const before = first.steps[first.steps.length - 2];
	const halfStride =
		last && before
			? Math.hypot(
					sim.position(last.state).x - sim.position(before.state).x,
					sim.position(last.state).y - sim.position(before.state).y,
				) / 2
			: 0;
	// If neither dogleg order fits, split each corridor leg and search again.
	// Every candidate still uses the same footprint/settle validation.
	if (first.distance > Math.max(2, halfStride)) {
		const split = legs.flatMap((leg) => {
			const midpoint = {
				x: (leg.from.x + leg.to.x) / 2,
				y: (leg.from.y + leg.to.y) / 2,
			};
			return [
				{ ...leg, to: midpoint },
				{ ...leg, from: midpoint, corner: true },
			];
		});
		const alternative = simulatePlan(split, initial, sim);
		if (alternative.distance < first.distance) {
			legs = split;
			first = alternative;
		}
	}
	if (!sim.offset) return first;
	let corrections = legs.map(() => ({ x: 0, y: 0 }));
	for (let pass = 0; pass < 3; pass++) {
		const proposed = legs.map((leg, i) => {
			const steps = first.steps.filter((s) => s.leg === i);
			if (steps.length < 2) return corrections[i];
			const last = steps[steps.length - 1];
			const p = last.stop
				? (sim.rest(last.state, last.pose, last.heading) ??
					sim.position(last.state))
				: sim.position(last.state);
			const dx = corrections[i].x + (leg.to.x - p.x) / steps.length;
			const dy = corrections[i].y + (leg.to.y - p.y) / steps.length;
			const factor = Math.min(1, 0.99 / Math.hypot(dx, dy));
			return { x: dx * factor, y: dy * factor };
		});
		const corrected = simulatePlan(legs, initial, sim, proposed);
		if (corrected.distance >= first.distance) break;
		first = corrected;
		corrections = proposed;
	}
	return first;
}
