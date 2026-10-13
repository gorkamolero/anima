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
	resolution?: number;
	turnCost?: number;
	stepCost?: number;
	/** Stride cap used for the goal radius. A larger drawn stride does not enlarge the goal set. */
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
 * The caller supplies a target projected onto the reachable walk area. */
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
	// Distance is a lower bound on distance+turn+step costs, including the
	// stop edge. Subtract only the maximum goal radius, not the stop travel.
	const heuristic = (p: Point) =>
		Math.max(0, distance(p, goal) - maxStride / 2);
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
		if (
			now() - started >=
			(options.timeBudgetMs ?? 30) - (sim.offset ? 3 : 0)
		) {
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
			const candidates = best
				? sim.restCandidates?.(node.state, pose)
				: undefined;
			const canImprove =
				!candidates ||
				candidates.some(
					(q) =>
						distance(ground(q), goal) <=
						Math.max(best?.distance ?? Infinity, maxStride / 2) + 1e-6,
				);
			const rest = canImprove ? sim.rest(node.state, pose, heading) : undefined;
			if (rest && (node.parent || next)) {
				const remaining = distance(ground(rest), goal);
				const complete =
					remaining <= Math.min(stride, maxStride) / 2 + 1e-8 &&
					(sim.acceptRest?.(node.state, pose, rest, target) ?? true);
				const cost =
					node.g +
					(rest.travel ?? distance(p, ground(rest))) +
					turnPenalty +
					stepCost;
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
	let last = best
		? sim.rest(best.node.state, best.step.pose, best.step.heading)
		: undefined;
	let complete = best?.complete ?? false;
	let correction = { x: 0, y: 0 };
	// Refine only the allowed subpixel anchor slide on the fixed search result.
	// No heading, stance count or route is changed. Re-simulate every support
	// and settle before accepting a correction; playback consumes these poses.
	if (!complete && last && sim.offset && steps.length > 1) {
		const original = steps.slice();
		for (
			let pass = 0;
			pass < 3 && now() - started < (options.timeBudgetMs ?? 30);
			pass++
		) {
			const proposed = {
				x: correction.x + (target.x - last.x) / (steps.length - 1),
				y: correction.y + (target.y - last.y) / (steps.length - 1),
			};
			const factor = Math.min(1, 0.99 / Math.hypot(proposed.x, proposed.y));
			const slide = { x: proposed.x * factor, y: proposed.y * factor };
			const trial: PlannedStep<State, Pose>[] = [];
			let state = original[0].state,
				rest: Point | undefined,
				stride = 0,
				valid = true;
			for (let i = 0; i < original.length; i++) {
				const delta = i ? slide : { x: 0, y: 0 };
				state = sim.offset(state, delta);
				const previous = original[i],
					pose = sim.entry(state, previous.heading, i === 0);
				if (pose === undefined) {
					valid = false;
					break;
				}
				trial.push({ ...previous, state, pose, slide: delta });
				const next = sim.advance(state, pose);
				if (next)
					stride = distance(
						ground(sim.position(state)),
						ground(sim.position(next)),
					);
				if (previous.stop) {
					rest = sim.rest(state, pose, previous.heading);
					break;
				}
				if (!next) {
					valid = false;
					break;
				}
				state = next;
			}
			if (
				!valid ||
				!rest ||
				distance(ground(rest), goal) >= distance(ground(last), goal)
			)
				break;
			steps.splice(0, steps.length, ...trial);
			last = rest;
			correction = slide;
			const final = trial[trial.length - 1];
			complete =
				distance(ground(rest), goal) <=
					Math.min(stride, maxStride) / 2 + 1e-8 &&
				(sim.acceptRest?.(final.state, final.pose, rest, target) ?? true);
			if (complete) break;
		}
	}

	return {
		steps,
		distance: last ? distance(last, target) : Infinity,
		complete,
		stats: {
			expanded,
			generated,
			elapsedMs: now() - started,
			reason,
		} satisfies SearchStats,
	};
}
