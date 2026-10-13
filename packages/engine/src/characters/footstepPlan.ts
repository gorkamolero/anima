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
	/** Support and phase are part of the lattice, never inferred from position. */
	support?(state: State): string;
	entry(
		state: State,
		heading: WalkDirection,
		starting: boolean,
	): Pose | undefined;
	advance(state: State, pose: Pose): State | undefined;
	/** Validate the complete exit and settle; return the final planted sole. */
	rest(state: State, pose: Pose, heading: WalkDirection): Point | undefined;
}
export interface SearchOptions {
	nodeBudget?: number;
	timeBudgetMs?: number;
	resolution?: number;
	turnCost?: number;
	stepCost?: number;
	/** Conservative bound on any support displacement, including a stop. */
	maxStride?: number;
	now?: () => number;
}
export interface SearchStats {
	expanded: number;
	generated: number;
	elapsedMs: number;
	reason: "goal" | "exhausted" | "node-budget" | "time-budget";
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

/** A* on 3 cm support cells × foot/phase × heading. Positions are only
 * quantised for duplicate detection: playback retains exact simulated poses.
 * The route supplies a reachable target, not a sequence of steering legs. */
export function planFootsteps<State, Pose>(
	legs: readonly WalkLeg[],
	initial: State,
	sim: StepSimulation<State, Pose>,
	options: SearchOptions = {},
) {
	const now = options.now ?? (() => performance.now());
	const started = now();
	const ground = sim.ground ?? ((p: Point) => p);
	const target = legs[legs.length - 1]?.to ?? sim.position(initial);
	const goal = ground(target);
	const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
	const resolution = options.resolution ?? 0.03;
	const turnCost = options.turnCost ?? 0.6;
	const stepCost = options.stepCost ?? 0.02;
	const maxStride = options.maxStride ?? 0.6;
	// Distance is a lower bound on all distance+turn+step costs. Subtract
	// the stop's maximum travel and goal radius so h=0 throughout the goal set.
	const heuristic = (p: Point) =>
		Math.max(0, distance(p, goal) - maxStride * 2.5);
	type Node = {
		state: State;
		heading?: WalkDirection;
		parent?: Node;
		step?: PlannedStep<State, Pose>;
		g: number;
		f: number;
		key: string;
		stride: number;
	};
	const key = (state: State, heading?: WalkDirection) => {
		const p = ground(sim.position(state));
		return `${Math.round(p.x / resolution)},${Math.round(p.y / resolution)},${sim.support?.(state) ?? ""},${heading ?? "standing"}`;
	};
	const open = new Heap<Node>();
	const start: Node = {
		state: initial,
		g: 0,
		f: heuristic(ground(sim.position(initial))),
		key: key(initial),
		stride: 0,
	};
	open.push(start);
	const costs = new Map([[start.key, 0]]);
	let expanded = 0,
		generated = 1;
	let reason: SearchStats["reason"] = "exhausted";
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
		leg: 0,
		slide: { x: 0, y: 0 },
	});
	for (let node = open.pop(); node; node = open.pop()) {
		if (node.g !== costs.get(node.key)) continue;
		if (best?.complete && node.f >= best.cost) {
			reason = "goal";
			break;
		}
		if (expanded >= (options.nodeBudget ?? 12000)) {
			reason = "node-budget";
			break;
		}
		if (now() - started >= (options.timeBudgetMs ?? 30)) {
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
			const pose = sim.entry(node.state, heading, node.heading === undefined);
			if (pose === undefined) continue;
			const p = ground(sim.position(node.state));
			const next = sim.advance(node.state, pose);
			const stride = next
				? distance(p, ground(sim.position(next)))
				: node.stride;
			const turnPenalty = turnCost * turn + (turn === 2 ? turnCost : 0);
			// Stopping is an edge, including all exit-frame motion. It cannot evade
			// the turn cost or introduce a heading reversal at the final drawing.
			const remainingBeforeStop = distance(p, goal);
			const rest =
				!best ||
				remainingBeforeStop <= best.distance + maxStride * 2 ||
				remainingBeforeStop <= maxStride * 2.5
					? sim.rest(node.state, pose, heading)
					: undefined;
			if (rest && (node.parent || next)) {
				const remaining = distance(ground(rest), goal);
				const complete = remaining <= stride / 2 + 1e-8;
				const cost =
					node.g + distance(p, ground(rest)) + turnPenalty + stepCost;
				if (
					!best ||
					(complete && !best.complete) ||
					(complete === best.complete &&
						(complete ? cost < best.cost : remaining < best.distance))
				)
					best = {
						node,
						step: stepFor(node, heading, pose, true),
						distance: remaining,
						cost,
						complete,
					};
			}
			if (!next || stride < 1e-8) continue;
			const g = node.g + stride + turnPenalty + stepCost;
			const nextKey = key(next, heading);
			if (g >= (costs.get(nextKey) ?? Infinity)) continue;
			costs.set(nextKey, g);
			open.push({
				state: next,
				heading,
				parent: node,
				step: stepFor(node, heading, pose, false),
				g,
				f: g + heuristic(ground(sim.position(next))),
				key: nextKey,
				stride,
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
	if (best?.complete && reason === "exhausted") reason = "goal";
	const last = best
		? sim.rest(best.node.state, best.step.pose, best.step.heading)
		: undefined;
	return {
		steps,
		distance: last ? distance(last, target) : Infinity,
		complete: best?.complete ?? false,
		stats: {
			expanded,
			generated,
			elapsedMs: now() - started,
			reason,
		} satisfies SearchStats,
	};
}
