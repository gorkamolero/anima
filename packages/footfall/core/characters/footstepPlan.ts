import type { Point } from "../walkarea/perspective";
import { GROUND_SECTORS, type WalkDirection } from "./walkHeading";

export interface PlannedStep<State, Pose> {
	heading: WalkDirection;
	/** An idle final pivot retains the last walking stride for arrival tolerance. */
	arrivalHeading?: WalkDirection;
	pose: Pose;
	state: State;
	stop: boolean;
	slide: Point;
}
export interface StepSimulation<State, Pose> {
	/** Exact terminal validation; a rejected goal leaves this same frontier active. */
	acceptPlan?(steps: PlannedStep<State, Pose>[]): boolean;
	/** Rank valid finishes at the first reached support without changing route costs. */
	finishRank?(steps: PlannedStep<State, Pose>[]): number;
	/** A negative first-capture limit rejects the starting pose. */
	startTurnLimit?(state: State, pose: Pose, heading: WalkDirection): number;
	position(state: State): Point;
	/** Additional zero-motion support choices, only at the standing start. */
	starts?(state: State): readonly State[];
	offset?(state: State, slide: Point): State;
	ground?(point: Point): Point;
	/** Collision-aware remaining route cost, in ground units. */
	remaining?(point: Point): number;
	/** Support and phase are part of the lattice, never inferred from position. */
	support?(state: State): string;
	entry(
		state: State,
		heading: WalkDirection,
		starting: boolean,
		stopping?: boolean,
	): Pose | undefined;
	entries?(
		state: State,
		heading: WalkDirection,
		starting: boolean,
		stopping?: boolean,
	): readonly Pose[];
	advance(state: State, pose: Pose): State | undefined;
	/** Fragments consume turns but cannot fill a sustained run. */
	countStance?(state: State, pose: Pose): boolean;
	stanceKey?(state: State, pose: Pose, heading: WalkDirection): string;
	/** Standing and support-transfer edges remain in this same search frontier. */
	continueFromRest?(
		state: State,
		pose: Pose,
		heading: WalkDirection,
		rest: Point,
	): readonly State[];
	/** Validate the turn budget against the route to the actual stop. */
	routeAllowed?(
		origin: State,
		rest: Point & {
			body?: Point;
			stances?: number;
			supports?: readonly { key: string; counted: boolean }[];
		},
		changes: number,
	): boolean;
	/** Validate the complete exit and settle; return the final planted sole. */
	rest(
		state: State,
		pose: Pose,
		heading: WalkDirection,
	):
		| (Point & {
				travel?: number;
				body?: Point;
				stances?: number;
				supports?: readonly { key: string; counted: boolean }[];
		  })
		| undefined;
	/** All possible exit support positions, before collision/settle validation. */
	restCandidates?(state: State, pose: Pose): readonly Point[];
	/** Character-specific authored arrival radius; independent of a partial entry. */
	acceptRest?(
		state: State,
		pose: Pose,
		rest: Point,
		target: Point,
		heading: WalkDirection,
	): boolean;
}
export interface RouteState {
	heading?: WalkDirection;
	changes: number;
	run: number;
	history: number;
	corner: number;
}
export interface SearchOptions {
	/** Share a boundary-start budget across depths and heading histories. */
	layeredFrontier?: boolean;
	/** Keep a stationary stop as fallback without pruning a valid walking route. */
	preferMotion?: boolean;
	/** Explicit preferences for a bounded, non-optimal first-arrival search. */
	firstArrival?: boolean;
	restartCost?: number;
	minRestartRun?: number;
	entryPhases?: "authored" | "all";
	/** Try a lower bound that does not require continuous floor between steps. */
	directHeuristic?: boolean;
	searchWeight?: number;
	/** Queue preference only; never excludes an arrival orientation. */
	goalHeadings?: readonly WalkDirection[];
	startPhases?: boolean;
	stopPhases?: boolean;
	pivotStops?: boolean;
	/** Preserve the complete click's route rules across a grounded restart. */
	initialRoute?: RouteState;
	nodeBudget?: number;
	timeBudgetMs?: number;
	/** Maximum path cost, including turns and the exit edge. */
	costBound?: number;
	/** Geometric search allowance, independent of the route turn limits. */
	costScale?: number;
	stopWeight?: number;
	resolution?: number;
	turnCost?: number;
	stepCost?: number;
	maxHeadingChanges?: number;
	minHeadingRun?: number;
	minFirstHeadingRun?: number;
	minTerminalRun?: number;
	/** Ordered shortest-route corners in ground coordinates. Each is usable once. */
	routeCorners?: readonly Point[];
	cornerRadius?: number;
	cornerHeadings?: readonly WalkDirection[];
	/** Stride cap used for the goal radius. A larger drawn stride does not enlarge the goal set. */
	maxStride?: number;
	now?: () => number;
}
export interface SearchStats {
	rejections?: Record<string, number>;
	expanded: number;
	generated: number;
	elapsedMs: number;
	reason: "complete" | "nearest-reachable" | "node-budget" | "time-budget";
	optimal: boolean;
	costBound: number;
}

class Heap<T extends { priority: number }> {
	private items: T[] = [];
	push(value: T) {
		let i = this.items.length;
		this.items.push(value);
		while (i) {
			const parent = (i - 1) >> 1;
			if (this.items[parent].priority <= value.priority) break;
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
					this.items[child + 1].priority < this.items[child].priority
				)
					child++;
				if (last.priority <= this.items[child].priority) break;
				this.items[i] = this.items[child];
				i = child;
			}
			this.items[i] = last;
		}
		return first;
	}
}

/** A bounded frontier for starts outside routing clearance. Evaluate diverse
 * short prefixes before allowing one low-priority family to spend the budget.
 * This schedules the same search edges; it never retries a completed search. */
class LayeredFrontier<
	T extends {
		priority: number;
		parent?: T;
		history: number;
		heading?: WalkDirection;
		run: number;
	},
> {
	private layers = new Map<number, Heap<T>>();
	private depths = new WeakMap<T, number>();
	private counts = new Map<string, number>();
	private depth = 0;
	private maximumDepth = 0;
	private layerCount = 0;
	constructor(
		private score: (node: T) => number,
		private current: (node: T) => boolean,
		private discard: (node: T) => void,
	) {}
	push(node: T) {
		const depth = node.parent ? (this.depths.get(node.parent) ?? 0) + 1 : 0;
		this.depths.set(node, depth);
		node.priority = this.score(node);
		this.maximumDepth = Math.max(this.maximumDepth, depth);
		let heap = this.layers.get(depth);
		if (!heap) {
			heap = new Heap<T>();
			this.layers.set(depth, heap);
		}
		heap.push(node);
	}
	pop(): T | undefined {
		while (this.depth <= this.maximumDepth) {
			const heap = this.layers.get(this.depth);
			if (this.layerCount >= 400) {
				for (let node = heap?.pop(); node; node = heap?.pop())
					this.discard(node);
			}
			const node = heap?.pop();
			if (!node) {
				this.layers.delete(this.depth++);
				this.layerCount = 0;
				this.counts.clear();
				continue;
			}
			if (!this.current(node)) continue;
			const key = `${node.history}:${node.heading ?? "start"}:${Math.min(node.run, 2)}`;
			const count = this.counts.get(key) ?? 0;
			if (count >= (this.depth ? 12 : 100)) {
				this.discard(node);
				continue;
			}
			this.counts.set(key, count + 1);
			this.layerCount++;
			return node;
		}
		return undefined;
	}
}

/** Best-first branch-and-bound over support cells, foot, phase and heading.
 * Every valid exit is a goal with residual-distance cost. Playback retains the
 * exact simulated positions; quantisation is only duplicate detection. */
export function planFootsteps<State, Pose>(
	target: Point,
	initial: State,
	sim: StepSimulation<State, Pose>,
	options: SearchOptions & { now: () => number },
) {
	const now = options.now;
	const started = now();
	const ground = sim.ground ?? ((p: Point) => p);
	const goal = ground(target);
	const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
	const resolution = options.resolution ?? 0.03;
	const turnCost = options.turnCost ?? 0.6;
	const arrivalTurn = (heading: WalkDirection) => {
		if (!options.firstArrival || !options.goalHeadings?.length) return 0;
		const sector = GROUND_SECTORS.indexOf(heading);
		return (
			turnCost *
			Math.min(
				...options.goalHeadings.map((h) => {
					const d = Math.abs(GROUND_SECTORS.indexOf(h) - sector);
					return Math.min(d, 8 - d);
				}),
			)
		);
	};
	const stepCost = options.stepCost ?? 0.02;
	const maxStride = options.maxStride ?? 0.6;
	const weight = Math.max(1, options.stopWeight ?? 8);
	const remaining = (p: Point) =>
		sim.remaining?.(p) ?? distance(ground(p), goal);
	const initialDistance = remaining(sim.position(initial));
	// The geometric allowance must also fund the permitted turn preferences.
	// A 90-degree turn costs three turn units; without this allowance a short
	// L corridor can exhaust its budget before its only valid corner.
	const costBound =
		options.costBound ??
		(options.costScale ?? 1.5) * initialDistance +
			2 +
			3 * turnCost * (options.maxHeadingChanges ?? 2);
	// For w >= 1, movement plus w * residual is at least straight distance.
	// With bounded remaining cost B, residual is at least max(0, d - B).
	const heuristic = (p: Point, g = 0) => {
		const d = remaining(p);
		return d + (weight - 1) * Math.max(0, d - (costBound - g));
	};
	type Node = {
		changeLimit: number;
		lastSupport?: string;
		lastCounted?: boolean;
		sinceRest: number;
		stances: number;
		origin: State;
		state: State;
		heading?: WalkDirection;
		drawnHeading?: WalkDirection;
		parent?: Node;
		step?: PlannedStep<State, Pose>;
		g: number;
		f: number;
		priority: number;
		key: string;
		stride: number;
		changes: number;
		run: number;
		history: number;
		corner: number;
	};
	const key = (
		state: State,
		heading?: WalkDirection,
		changes = 0,
		run = 0,
		history = 0,
		corner = 0,
	) => {
		const p = ground(sim.position(state));
		return `${Math.round(p.x / resolution)},${Math.round(p.y / resolution)},${sim.support?.(state) ?? ""},${heading ?? "standing"}:${options.maxHeadingChanges === undefined ? Math.min(changes, 1) : changes}:${Math.min(run, options.minHeadingRun ?? 0)}:${history}:${corner}`;
	};
	const costs = new Map<string, number>();
	const open =
		options.layeredFrontier && options.firstArrival
			? new LayeredFrontier<Node>(
					(node) =>
						distance(ground(sim.position(node.state)), goal) + 0.05 * node.g,
					(node) => node.g === costs.get(node.key),
					(node) => {
						if (node.g === costs.get(node.key)) costs.delete(node.key);
					},
				)
			: new Heap<Node>();
	const start: Node = {
		changeLimit: options.maxHeadingChanges ?? Infinity,
		sinceRest: options.minRestartRun ?? 0,
		stances: 0,
		origin: initial,
		state: initial,
		g: 0,
		f: heuristic(sim.position(initial)),
		priority: (options.searchWeight ?? 1) * heuristic(sim.position(initial)),
		key: key(initial),
		stride: 0,
		changes: 0,
		run: 0,
		history: 0,
		corner: 0,
		...options.initialRoute,
	};
	start.key = key(
		initial,
		start.heading,
		start.changes,
		start.run,
		start.history,
		start.corner,
	);
	open.push(start);
	costs.set(start.key, 0);
	let generated = 1;
	for (const state of sim.starts?.(initial) ?? []) {
		const alternative = {
			...start,
			origin: state,
			state,
			key: key(
				state,
				start.heading,
				start.changes,
				start.run,
				start.history,
				start.corner,
			),
			f: heuristic(sim.position(state)),
			priority: (options.searchWeight ?? 1) * heuristic(sim.position(state)),
		};
		if (costs.has(alternative.key)) continue;
		open.push(alternative);
		costs.set(alternative.key, 0);
		generated++;
	}
	const rejections: Record<string, number> = {};
	const reject = (reason: string) => {
		rejections[`search:${reason}`] = (rejections[`search:${reason}`] ?? 0) + 1;
	};
	let expanded = 0;
	let reason: SearchStats["reason"] = "nearest-reachable";
	let bestScore = options.preferMotion
		? Math.max(initialDistance * weight, costBound)
		: initialDistance * weight;
	let best:
		| {
				node: Node;
				step: PlannedStep<State, Pose>;
				distance: number;
				cost: number;
				complete: boolean;
				routeState: RouteState;
		  }
		| undefined;
	const searchBound = () =>
		options.firstArrival && !best?.complete
			? Math.max(bestScore, costBound)
			: bestScore;
	let stationary: typeof best;
	let stationaryScore = Infinity;
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
	const collect = (node: Node, step: PlannedStep<State, Pose>) => {
		const steps = [step];
		for (let n: Node | undefined = node; n?.step; n = n.parent)
			steps.push(n.step);
		return steps.reverse();
	};
	let bestFinishRank = Infinity;
	let acceptedSteps: PlannedStep<State, Pose>[] = [];
	const preferFinish = (complete: boolean) => {
		if (!complete || !options.firstArrival || !sim.finishRank) return true;
		const rank = sim.finishRank(acceptedSteps);
		if (best?.complete && rank >= bestFinishRank) return false;
		bestFinishRank = rank;
		return true;
	};
	const acceptable = (node: Node, step: PlannedStep<State, Pose>) => {
		acceptedSteps = collect(node, step);
		if (options.preferMotion && node.stances === 0) return true;
		if (!sim.acceptPlan || sim.acceptPlan(acceptedSteps)) return true;
		reject("playback-route");
		return false;
	};
	search: for (let node = open.pop(); node; node = open.pop()) {
		if (node.g !== costs.get(node.key)) continue;
		if (node.f >= searchBound()) {
			if ((options.searchWeight ?? 1) !== 1 || options.layeredFrontier)
				continue;
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
		// A final in-place turn is not another walking run. It must preserve the
		// support exactly, and cannot borrow a larger stride from the idle facing.
		if (
			options.pivotStops &&
			node.heading &&
			node.step &&
			(node.changes === 0 || node.run >= (options.minTerminalRun ?? 0))
		) {
			const p = ground(sim.position(node.state));
			for (const heading of GROUND_SECTORS) {
				const d = Math.abs(
					GROUND_SECTORS.indexOf(heading) -
						GROUND_SECTORS.indexOf(node.heading),
				);
				if (!d) continue;
				for (const pose of sim.entries?.(node.state, heading, false, true) ??
					[]) {
					// A planted finish cannot improve the anchor's arrival distance.
					// Reject distant poses before running the full exit animation.
					if (
						sim.acceptRest &&
						!sim.acceptRest(
							node.state,
							pose,
							sim.position(node.state),
							target,
							node.heading,
						)
					)
						continue;
					const rest = sim.rest(node.state, pose, heading);
					if (
						!rest ||
						distance(p, ground(rest)) > 1e-8 ||
						(rest.travel ?? 0) > 1e-8
					)
						continue;
					const residual = distance(ground(rest), goal);
					const complete =
						sim.acceptRest?.(node.state, pose, rest, target, node.heading) ??
						residual <= Math.min(node.stride, maxStride) / 2;
					if (!complete) continue;
					const cost = node.g + stepCost;
					const score =
						cost +
						(options.firstArrival && complete ? 0 : weight * remaining(rest));
					if (cost > costBound || (!options.firstArrival && score >= bestScore))
						continue;
					if (
						sim.routeAllowed &&
						!sim.routeAllowed(node.origin, rest, node.changes)
					)
						continue;
					if (
						!acceptable(node, {
							...stepFor(node, heading, pose, true),
							arrivalHeading: node.heading,
						})
					)
						continue;
					if (!preferFinish(complete)) continue;
					const previousBest = best,
						previousScore = bestScore;
					bestScore = score;
					best = {
						node,
						step: {
							...stepFor(node, heading, pose, true),
							arrivalHeading: node.heading,
						},
						distance: residual,
						cost,
						complete,
						routeState: {
							heading: node.heading,
							changes: node.changes,
							run: node.run,
							history: node.history,
							corner: node.corner,
						},
					};
					if (options.preferMotion && node.stances === 0) {
						if (score < stationaryScore) {
							stationary = best;
							stationaryScore = score;
						}
						best = previousBest;
						bestScore = previousScore;
					}
				}
			}
		}
		for (const heading of GROUND_SECTORS) {
			const delta =
				node.heading === undefined
					? 0
					: Math.abs(
							GROUND_SECTORS.indexOf(heading) -
								GROUND_SECTORS.indexOf(node.heading),
						);
			const turn = Math.min(delta, 8 - delta);
			if (turn > 2) {
				reject("reversal");
				continue;
			}
			const drawnDelta =
				node.drawnHeading === undefined
					? delta
					: Math.abs(
							GROUND_SECTORS.indexOf(heading) -
								GROUND_SECTORS.indexOf(node.drawnHeading),
						);
			const drawnTurn = Math.min(drawnDelta, 8 - drawnDelta);
			if (drawnTurn > 2) {
				reject("reversal");
				continue;
			}
			const changes = node.changes + (drawnTurn ? 1 : 0);
			if (
				turn &&
				node.run <
					(node.changes > 0
						? (options.minHeadingRun ?? 0)
						: (options.minFirstHeadingRun ?? 0))
			) {
				reject("min-heading-run");
				continue;
			}
			let history = node.history;
			let corner = node.corner;
			const at = ground(sim.position(node.state));
			// One authored stride can round several adjacent raster bends. Consume
			// each compatible corner once, rather than leaving the next bend behind.
			while (turn && options.routeCorners?.[corner]) {
				const routeCorner = options.routeCorners[corner];
				const outgoing = options.cornerHeadings?.[corner];
				const delta =
					outgoing === undefined
						? 0
						: Math.abs(
								GROUND_SECTORS.indexOf(outgoing) -
									GROUND_SECTORS.indexOf(heading),
							);
				if (
					Math.min(delta, 8 - delta) > 1 ||
					distance(at, routeCorner) > (options.cornerRadius ?? maxStride)
				)
					break;
				history = 0;
				corner++;
			}
			const changeLimit = Math.min(
				node.changeLimit,
				options.routeCorners ? 2 + 2 * corner : Infinity,
			);
			if (changes > changeLimit) {
				reject("turn-limit");
				continue;
			}
			const sector = GROUND_SECTORS.indexOf(heading);
			// Reversals are measured between consecutive runs. An initial heading
			// must not forbid a later legal bend after two sustained stances;
			// the shared corner/change budget still bounds the complete route.
			history |= 1 << sector;

			const poses = sim.entries?.(
				node.state,
				heading,
				node.step === undefined || node.step.stop,
			) ?? [
				sim.entry(
					node.state,
					heading,
					node.step === undefined || node.step.stop,
				),
			];
			const actions = (poses.length ? poses : [undefined]).map((pose) => ({
				pose,
				stopPose:
					pose ??
					sim.entry(
						node.state,
						heading,
						node.step === undefined || node.step.stop,
						true,
					),
			}));
			if (options.stopPhases)
				for (const stopPose of sim.entries?.(
					node.state,
					heading,
					node.step === undefined || node.step.stop,
					true,
				) ?? [])
					if (!poses.includes(stopPose))
						actions.push({ pose: undefined, stopPose });
			for (const { pose, stopPose } of actions) {
				if (pose === undefined && stopPose === undefined) continue;
				const p = ground(sim.position(node.state));
				const next =
					pose === undefined ? undefined : sim.advance(node.state, pose);
				const supportKey =
					pose === undefined
						? undefined
						: sim.stanceKey?.(node.state, pose, heading);
				const rawCounted =
					pose !== undefined && (sim.countStance?.(node.state, pose) ?? true);
				const counted =
					rawCounted &&
					(supportKey === undefined ||
						supportKey !== node.lastSupport ||
						!node.lastCounted);
				const run = (turn ? 0 : node.run) + (counted ? 1 : 0);
				const stride = next
					? distance(p, ground(sim.position(next)))
					: node.stride;
				const chargedTurn = Math.max(turn, drawnTurn);
				const turnPenalty =
					turnCost * chargedTurn + (chargedTurn === 2 ? turnCost : 0);
				// Stopping is an edge, including all exit-frame motion. It cannot evade
				// the turn cost or introduce a heading reversal at the final drawing.
				// A restart requires evaluating the stop regardless of terminal cost.
				// Do not simulate candidate exits for a bound that cannot prune it.
				const candidates =
					best && !sim.continueFromRest
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
							cost <= costBound && cost + weight * remaining(q) < bestScore
						);
					});
				const rest =
					(canImprove || sim.continueFromRest) && stopPose !== undefined
						? sim.rest(node.state, stopPose, heading)
						: undefined;
				if (rest && stopPose !== undefined) {
					let lastSupport = node.lastSupport,
						lastCounted = node.lastCounted;
					let stopCount = rest.supports ? 0 : (rest.stances ?? 0);
					for (const support of rest.supports ?? []) {
						if (support.key === lastSupport) {
							if (support.counted && !lastCounted) stopCount++;
							lastCounted ||= support.counted;
						} else {
							lastSupport = support.key;
							lastCounted = support.counted;
							if (support.counted) stopCount++;
						}
					}
					const remaining = distance(ground(rest), goal);
					const complete =
						sim.acceptRest?.(node.state, stopPose, rest, target, heading) ??
						remaining <= Math.min(stride, maxStride) / 2 + 1e-8;
					const cost =
						node.g +
						(rest.travel ?? distance(p, ground(rest))) +
						turnPenalty +
						stepCost;
					const score =
						cost +
						(options.firstArrival && complete
							? 0
							: weight * (sim.remaining?.(rest) ?? remaining));
					if (
						node.step &&
						cost <= costBound &&
						sim.continueFromRest &&
						node.sinceRest + stopCount >= (options.minRestartRun ?? 0)
					) {
						// A settling pose has a drawn heading but contributes no walking
						// stance. Preserve the run; still charge and constrain each drawn turn.
						const restHeading = stopCount ? heading : node.heading;
						const restRun = stopCount
							? (turn ? 0 : node.run) + stopCount
							: node.run;
						for (const standing of sim.continueFromRest(
							node.state,
							stopPose,
							heading,
							rest,
						)) {
							const g = cost + (options.restartCost ?? stepCost);
							const f = g + heuristic(sim.position(standing), g);
							if (g > costBound || f >= searchBound()) continue;
							const k =
								key(standing, restHeading, changes, restRun, history, corner) +
								`:drawn:${heading}` +
								(options.minRestartRun ? ":rest:0" : "") +
								`:held:${lastSupport ?? ""}:${!!lastCounted}:limit:${node.changeLimit}`;
							if (g >= (costs.get(k) ?? Infinity)) continue;
							costs.set(k, g);
							open.push({
								state: standing,
								origin: node.origin,
								sinceRest: 0,
								changeLimit: node.changeLimit,
								stances: node.stances + stopCount,
								lastSupport,
								lastCounted,
								heading: restHeading,
								drawnHeading: heading,
								parent: node,
								step: stepFor(node, heading, stopPose, true),
								g,
								f,
								priority:
									g +
									(options.searchWeight ?? 1) *
										heuristic(sim.position(standing), g) +
									arrivalTurn(heading),
								key: k,
								stride,
								changes,
								run: restRun,
								history,
								corner,
							});
							generated++;
						}
					}
					if (
						(node.changes === 0 || node.run >= (options.minTerminalRun ?? 0)) &&
						cost <= costBound &&
						((options.firstArrival && complete) || score < bestScore) &&
						(!sim.routeAllowed ||
							sim.routeAllowed(node.origin, rest, changes)) &&
						acceptable(node, stepFor(node, heading, stopPose, true)) &&
						preferFinish(complete)
					) {
						const previousBest = best,
							previousScore = bestScore;
						bestScore = score;
						best = {
							node,
							step: stepFor(node, heading, stopPose, true),
							distance: remaining,
							cost,
							complete,
							routeState: { heading, changes, run, history, corner },
						};
						if (options.preferMotion && node.stances === 0) {
							if (score < stationaryScore) {
								stationary = best;
								stationaryScore = score;
							}
							best = previousBest;
							bestScore = previousScore;
						}
					}
				}
				if (options.firstArrival && best?.complete && !sim.finishRank) {
					reason = "complete";
					break search;
				}
				if (!next || pose === undefined || stride < 1e-8) continue;
				const g = node.g + stride + turnPenalty + stepCost;
				if (g > costBound) {
					reject("cost-bound");
					continue;
				}
				const f = g + heuristic(sim.position(next), g);
				if (f >= searchBound()) {
					reject("score-bound");
					continue;
				}
				const captureLimit = node.step
					? node.changeLimit
					: Math.min(
							node.changeLimit,
							sim.startTurnLimit?.(node.state, pose, heading) ?? Infinity,
						);
				if (changes > captureLimit) {
					reject("start-turn-limit");
					continue;
				}
				const nextKey =
					key(next, heading, changes, run, history, corner) +
					`:limit:${captureLimit}` +
					(options.minRestartRun
						? `:rest:${Math.min(options.minRestartRun, node.sinceRest + (counted ? 1 : 0))}`
						: "");
				if (g >= (costs.get(nextKey) ?? Infinity)) {
					reject("duplicate");
					continue;
				}
				costs.set(nextKey, g);
				open.push({
					changeLimit: captureLimit,
					sinceRest: node.sinceRest + (counted ? 1 : 0),
					stances: node.stances + (counted ? 1 : 0),
					lastSupport: supportKey,
					lastCounted:
						rawCounted || (supportKey === node.lastSupport && node.lastCounted),
					origin: node.origin,
					state: next,
					heading,
					parent: node,
					step: stepFor(node, heading, pose, false),
					g,
					f,
					priority:
						g +
						(options.searchWeight ?? 1) * heuristic(sim.position(next), g) +
						arrivalTurn(heading),
					key: nextKey,
					stride,
					changes,
					run,
					history,
					corner,
				});
				generated++;
			}
		}
		if (options.firstArrival && best?.complete) {
			reason = "complete";
			break;
		}
	}
	if (!best?.complete && stationary?.complete) best = stationary;
	best ??= stationary;
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
		routeState: best?.routeState,
		distance: distance(last ?? sim.position(initial), target),
		arrivalKind: complete ? ("exact" as const) : ("nearest-reachable" as const),
		complete,
		stats: {
			rejections,
			expanded,
			generated,
			elapsedMs: now() - started,
			reason,
			optimal:
				!options.firstArrival &&
				!sim.remaining &&
				(options.searchWeight ?? 1) === 1 &&
				!reason.endsWith("budget"),
			costBound,
		} satisfies SearchStats,
	};
}
