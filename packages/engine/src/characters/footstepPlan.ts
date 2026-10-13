import type { Point } from "../walkarea/perspective";
import { GROUND_SECTORS, type WalkDirection } from "./walkHeading";

export interface PlannedStep<State, Pose> {
	heading: WalkDirection;
	pose: Pose;
	state: State;
	stop: boolean;
	slide: Point;
}
export interface StepSimulation<State, Pose> {
	position(state: State): Point;
	/** Additional zero-motion support choices, only at the standing start. */
	starts?(state: State): readonly State[];
	offset?(state: State, slide: Point): State;
	ground?(point: Point): Point;
	/** Support and phase are part of the lattice, never inferred from position. */
	support?(state: State): string;
	entry(
		state: State,
		heading: WalkDirection,
		starting: boolean,
		stopping?: boolean,
	): Pose | undefined;
	advance(state: State, pose: Pose): State | undefined;
	/** Validate the complete exit and settle; return the final planted sole. */
	rest(
		state: State,
		pose: Pose,
		heading: WalkDirection,
	): (Point & { travel?: number }) | undefined;
	/** All possible exit support positions, before collision/settle validation. */
	restCandidates?(state: State, pose: Pose): readonly Point[];
	acceptRest?(state: State, pose: Pose, rest: Point, target: Point): boolean;
}
export interface SearchOptions {
	nodeBudget?: number;
	timeBudgetMs?: number;
	/** Maximum path cost, including turns and the exit edge. */
	costBound?: number;
	stopWeight?: number;
	resolution?: number;
	turnCost?: number;
	stepCost?: number;
	maxHeadingChanges?: number;
	minHeadingRun?: number;
	/** Stride cap used for the goal radius. A larger drawn stride does not enlarge the goal set. */
	maxStride?: number;
	now?: () => number;
}
export interface SearchStats {
	expanded: number;
	generated: number;
	elapsedMs: number;
	reason: "complete" | "nearest-reachable" | "node-budget" | "time-budget";
	optimal: boolean;
	costBound: number;
}

class Heap<T extends { f: number }> {
	private items: T[] = [];
	push(value: T) {
		let i = this.items.length;
		this.items.push(value);
		while (i) {
			const parent = (i - 1) >> 1;
			if (this.items[parent].f <= value.f) break;
			this.items[i] = this.items[parent];
			i = parent;
		}
		this.items[i] = value;
	}
	pop(): T | undefined {
		const first = this.items[0],
			last = this.items.pop();
		if (!last || !first) return;
		if (this.items.length) {
			let i = 0;
			while (2 * i + 1 < this.items.length) {
				let child = 2 * i + 1;
				if (
					child + 1 < this.items.length &&
					this.items[child + 1].f < this.items[child].f
				)
					child++;
				if (last.f <= this.items[child].f) break;
				this.items[i] = this.items[child];
				i = child;
			}
			this.items[i] = last;
		}
		return first;
	}
}

/** Best-first branch-and-bound over support cells, foot, phase and heading.
 * Every valid exit is a goal with residual-distance cost. Playback retains the
 * exact simulated positions; quantisation is only duplicate detection. */
export function planFootsteps<State, Pose>(
	target: Point,
	initial: State,
	sim: StepSimulation<State, Pose>,
	options: SearchOptions = {},
) {
	const now = options.now ?? (() => performance.now());
	const started = now();
	const ground = sim.ground ?? ((p: Point) => p);
	const goal = ground(target);
	const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
	const resolution = options.resolution ?? 0.03;
	const turnCost = options.turnCost ?? 0.6;
	const stepCost = options.stepCost ?? 0.02;
	const maxStride = options.maxStride ?? 0.6;
	const weight = Math.max(1, options.stopWeight ?? 8);
	const initialDistance = distance(ground(sim.position(initial)), goal);
	const costBound = options.costBound ?? 1.5 * initialDistance + 2;
	// For w >= 1, movement plus w * residual is at least straight distance.
	// With bounded remaining cost B, residual is at least max(0, d - B).
	const heuristic = (p: Point, g = 0) => {
		const d = distance(p, goal);
		return d + (weight - 1) * Math.max(0, d - (costBound - g));
	};
	type Node = {
		state: State;
		heading?: WalkDirection;
		parent?: Node;
		step?: PlannedStep<State, Pose>;
		g: number;
		f: number;
		key: string;
		stride: number;
		changes: number;
		run: number;
	};
	const key = (state: State, heading?: WalkDirection, changes = 0, run = 0) => {
		const p = ground(sim.position(state));
		return `${Math.round(p.x / resolution)},${Math.round(p.y / resolution)},${sim.support?.(state) ?? ""},${heading ?? "standing"}:${options.maxHeadingChanges === undefined ? 0 : changes}:${Math.min(run, options.minHeadingRun ?? 0)}`;
	};
	const open = new Heap<Node>();
	const start: Node = {
		state: initial,
		g: 0,
		f: heuristic(ground(sim.position(initial))),
		key: key(initial),
		stride: 0,
		changes: 0,
		run: 0,
	};
	open.push(start);
	const costs = new Map([[start.key, 0]]);
	let generated = 1;
	for (const state of sim.starts?.(initial) ?? []) {
		const alternative = {
			...start,
			state,
			key: key(state),
			f: heuristic(ground(sim.position(state))),
		};
		if (costs.has(alternative.key)) continue;
		open.push(alternative);
		costs.set(alternative.key, 0);
		generated++;
	}
	let expanded = 0;
	let reason: SearchStats["reason"] = "nearest-reachable";
	let bestScore = initialDistance * weight;
	let best:
		| {
				node: Node;
				step: PlannedStep<State, Pose>;
				distance: number;
				cost: number;
				complete: boolean;
		  }
		| undefined;
	const stepFor = (
		node: Node,
		heading: WalkDirection,
		pose: Pose,
		stop: boolean,
	): PlannedStep<State, Pose> => ({
		heading,
		pose,
		state: node.state,
		stop,
		slide: { x: 0, y: 0 },
	});
	for (let node = open.pop(); node; node = open.pop()) {
		if (node.g !== costs.get(node.key)) continue;
		if (node.f >= bestScore) {
			reason = best?.complete ? "complete" : "nearest-reachable";
			break;
		}
		if (expanded >= (options.nodeBudget ?? 12000)) {
			reason = "node-budget";
			break;
		}
		if (now() - started >= (options.timeBudgetMs ?? 130)) {
			reason = "time-budget";
			break;
		}
		expanded++;
		for (const heading of GROUND_SECTORS) {
			const delta =
				node.heading === undefined
					? 0
					: Math.abs(
							GROUND_SECTORS.indexOf(heading) -
								GROUND_SECTORS.indexOf(node.heading),
						);
			const turn = Math.min(delta, 8 - delta);
			if (turn > 2) continue;
			const changes = node.changes + (turn ? 1 : 0);
			if (changes > (options.maxHeadingChanges ?? Infinity)) continue;
			if (turn && node.changes > 0 && node.run < (options.minHeadingRun ?? 0))
				continue;
			const run = turn ? 1 : node.run + 1;
			const pose = sim.entry(node.state, heading, node.heading === undefined);
			const stopPose =
				sim.entry(node.state, heading, node.heading === undefined, true) ??
				pose;
			if (pose === undefined && stopPose === undefined) continue;
			const p = ground(sim.position(node.state));
			const next =
				pose === undefined ? undefined : sim.advance(node.state, pose);
			const stride = next
				? distance(p, ground(sim.position(next)))
				: node.stride;
			const turnPenalty = turnCost * turn + (turn === 2 ? turnCost : 0);
			// Stopping is an edge, including all exit-frame motion. It cannot evade
			// the turn cost or introduce a heading reversal at the final drawing.
			const candidates = best
				? stopPose === undefined
					? undefined
					: sim.restCandidates?.(node.state, stopPose)
				: undefined;
			const canImprove =
				!candidates ||
				candidates.some((q) => {
					const point = ground(q);
					const cost = node.g + distance(p, point) + turnPenalty + stepCost;
					return (
						cost <= costBound &&
						cost + weight * distance(point, goal) < bestScore
					);
				});
			const rest =
				canImprove && stopPose !== undefined
					? sim.rest(node.state, stopPose, heading)
					: undefined;
			if (rest && stopPose !== undefined) {
				const remaining = distance(ground(rest), goal);
				const complete =
					remaining <= Math.min(stride, maxStride) / 2 + 1e-8 &&
					(sim.acceptRest?.(node.state, stopPose, rest, target) ?? true);
				const cost =
					node.g +
					(rest.travel ?? distance(p, ground(rest))) +
					turnPenalty +
					stepCost;
				const score = cost + weight * remaining;
				if (cost <= costBound && score < bestScore) {
					bestScore = score;
					best = {
						node,
						step: stepFor(node, heading, stopPose, true),
						distance: remaining,
						cost,
						complete,
					};
				}
			}
			if (!next || pose === undefined || stride < 1e-8) continue;
			const g = node.g + stride + turnPenalty + stepCost;
			if (g > costBound) continue;
			const f = g + heuristic(ground(sim.position(next)), g);
			if (f >= bestScore) continue;
			const nextKey = key(next, heading, changes, run);
			if (g >= (costs.get(nextKey) ?? Infinity)) continue;
			costs.set(nextKey, g);
			open.push({
				state: next,
				heading,
				parent: node,
				step: stepFor(node, heading, pose, false),
				g,
				f,
				key: nextKey,
				stride,
				changes,
				run,
			});
			generated++;
		}
	}
	const steps: PlannedStep<State, Pose>[] = [];
	if (best) {
		steps.push(best.step);
		for (let n: Node | undefined = best.node; n?.step; n = n.parent)
			steps.push(n.step);
		steps.reverse();
	}
	if (!reason.endsWith("budget"))
		reason = best?.complete ? "complete" : "nearest-reachable";
	const last = best
		? sim.rest(best.node.state, best.step.pose, best.step.heading)
		: sim.position(initial);
	const complete = best?.complete ?? initialDistance <= maxStride / 2;

	return {
		steps,
		distance: distance(last ?? sim.position(initial), target),
		arrivalKind: complete ? ("exact" as const) : ("nearest-reachable" as const),
		complete,
		stats: {
			expanded,
			generated,
			elapsedMs: now() - started,
			reason,
			optimal: !reason.endsWith("budget"),
			costBound,
		} satisfies SearchStats,
	};
}
