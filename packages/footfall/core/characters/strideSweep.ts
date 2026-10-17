import { cellAt } from "../walkarea/navigation";
import { type Point, scaleAt, toMetres } from "../walkarea/perspective";
import type { FloorMask, WalkArea } from "../walkarea/types";
import { stanceSweep } from "./stanceSweep";

const freeObjects = new WeakMap<FloorMask, FloorMask>();

function on(mask: FloorMask, point: Point): boolean {
	return mask.data[cellAt(mask, point)] > 0;
}

function ground(area: WalkArea, point: Point): Point {
	if (area.perspective.constant === undefined)
		return toMetres(area.perspective, point);
	const ppm =
		(area.perspective.pixelsPerMetre ?? 300) * scaleAt(area.perspective, point);
	return { x: point.x / ppm, y: point.y / ppm };
}

function distance(area: WalkArea, a: Point, b: Point): number {
	const x = ground(area, a),
		y = ground(area, b);
	return Math.hypot(x.x - y.x, x.y - y.y);
}

/** Exact cell-boundary intervals, including arbitrarily short intersections. */
function intervals(mask: FloorMask, a: Point, b: Point): number[] {
	const cuts = [0, 1];
	for (const [start, end, size] of [
		[a.x, b.x, 1920 / mask.width],
		[a.y, b.y, 1080 / mask.height],
	]) {
		if (start === end) continue;
		for (
			let i = Math.floor(Math.min(start, end) / size) + 1;
			i * size < Math.max(start, end);
			i++
		)
			cuts.push((i * size - start) / (end - start));
	}
	return cuts;
}

/** The soles must have support. Only the airborne gap between them may lack
 * floor; a prop or a clearance exclusion on real floor is never a gap. Widths
 * are measured in ground metres, not a fixed number of screen pixels. */
export function strideSweep(
	area: WalkArea,
	soles: readonly [Point, Point],
	body: readonly Point[],
): boolean {
	const raw = area.rawMask ?? area.mask;
	const clearance = area.clearanceMask ?? area.mask;
	const objects = area.objectFootprints;
	let free = objects && freeObjects.get(objects);
	if (objects && !free) {
		free = { ...objects, data: objects.data.map((v) => (v ? 0 : 1)) };
		freeObjects.set(objects, free);
	}
	// A fully supported sole-only sweep needs no metric gap calculation.
	// Preserve object exclusion even when raw floor includes the prop pixels.
	if (!body.length && stanceSweep(raw, soles[0], soles[1]))
		return !free || stanceSweep(free, soles[0], soles[1]);
	// The final body sweep rejects blocked clearance on supported floor even
	// when another part of the stride crosses a gap. Reject that same condition
	// before allocating interval lists or projecting gap lengths.
	for (const point of body)
		if (on(raw, point) && !on(clearance, point)) return false;
	if (soles.some((p) => !on(raw, p) || (objects && on(objects, p))))
		return false;
	const limit = 0.4 * distance(area, ...soles);
	const sweep = (input: readonly Point[], checkClearance: boolean) => {
		const path = [...input];
		// The body may still be above the gap at a support transfer. Measure the
		// whole hole along its travel ray; do not require the body to land there.
		if (checkClearance && path.length) {
			const extend = (p: Point, q: Point, sign: number): Point | undefined => {
				if (on(raw, p)) return p;
				if (cellAt(raw, p) < 0) return;
				let dx = q.x - p.x,
					dy = q.y - p.y;
				if (!dx && !dy) {
					dx = soles[1].x - soles[0].x;
					dy = soles[1].y - soles[0].y;
				}
				const length = Math.hypot(dx, dy);
				if (!length) return;
				const end = {
					x: p.x + ((sign * dx) / length) * 3000,
					y: p.y + ((sign * dy) / length) * 3000,
				};
				const cuts = intervals(raw, p, end).sort((a, b) => a - b);
				for (let i = 1; i < cuts.length; i++) {
					const t = cuts[i - 1] + Math.min(1e-7, (cuts[i] - cuts[i - 1]) / 2);
					const candidate = {
						x: p.x + (end.x - p.x) * t,
						y: p.y + (end.y - p.y) * t,
					};
					if (
						cellAt(raw, candidate) < 0 ||
						distance(area, p, candidate) >= limit
					)
						return;
					if (on(raw, candidate)) return candidate;
				}
			};
			const start = extend(
				path[0],
				path.find((p) => p.x !== path[0].x || p.y !== path[0].y) ?? soles[1],
				-1,
			);
			const last = path[path.length - 1];
			const before =
				[...path].reverse().find((p) => p.x !== last.x || p.y !== last.y) ??
				soles[0];
			const end = extend(last, before, -1);
			if (!start || !end) return false;
			path.unshift(start);
			path.push(end);
		}
		if (!path.length || !on(raw, path[0]) || !on(raw, path[path.length - 1]))
			return false;
		if (
			free &&
			path.some((p, i) => !stanceSweep(free, path[Math.max(0, i - 1)], p))
		)
			return false;
		const mask = checkClearance ? clearance : raw;
		if (path.every((p, i) => stanceSweep(mask, path[Math.max(0, i - 1)], p)))
			return true;
		let gap = 0;
		for (let j = 1; j < path.length; j++) {
			const a = path[j - 1],
				b = path[j];
			const at = (t: number) => ({
				x: a.x + (b.x - a.x) * t,
				y: a.y + (b.y - a.y) * t,
			});
			const cuts = [
				...new Set(
					[raw, clearance, ...(objects ? [objects] : [])].flatMap((m) =>
						intervals(m, a, b),
					),
				),
			].sort((x, y) => x - y);
			for (let i = 1; i < cuts.length; i++) {
				const p = at((cuts[i - 1] + cuts[i]) / 2);
				if (cellAt(raw, p) < 0 || (objects && on(objects, p))) return false;
				if (on(raw, p)) {
					if (checkClearance && !on(clearance, p)) return false;
					gap = 0;
				} else {
					gap += distance(area, at(cuts[i - 1]), at(cuts[i]));
					if (!(gap < limit)) return false;
				}
			}
		}
		return (
			!checkClearance || path.every((p) => !on(raw, p) || on(clearance, p))
		);
	};
	return sweep(soles, false) && (!body.length || sweep(body, true));
}
