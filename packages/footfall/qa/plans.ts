import { exitAt } from "../core/occlusion/exits";
import { baselineYAt } from "../core/occlusion/occlusion";
import { cellPoint, findPath, nearestCell } from "../core/walkarea/navigation";
import type { Point } from "../core/walkarea/perspective";
import type { SceneRecord, WalkBeat, WalkPlan } from "../sim/types";

/** Deterministic coverage from a scene's reachable mask, with explicit missing coverage. */
export function generateWalkPlan(scene: SceneRecord): WalkPlan {
	const mask = scene.area.mask;
	if (!mask.data.some(Boolean))
		throw new Error("Cannot generate walks for an empty walk area");
	// Select the largest four-connected component, matching the reviewer coverage model.
	const visited = new Set<number>();
	let component: number[] = [];
	for (let seed = 0; seed < mask.data.length; seed++) {
		if (!mask.data[seed] || visited.has(seed)) continue;
		const queue = [seed];
		visited.add(seed);
		for (let n = 0; n < queue.length; n++) {
			const i = queue[n],
				x = i % mask.width,
				y = Math.floor(i / mask.width);
			for (const [cx, cy] of [
				[x - 1, y],
				[x + 1, y],
				[x, y - 1],
				[x, y + 1],
			]) {
				const j = cy * mask.width + cx;
				if (
					cx >= 0 &&
					cy >= 0 &&
					cx < mask.width &&
					cy < mask.height &&
					mask.data[j] &&
					!visited.has(j)
				) {
					visited.add(j);
					queue.push(j);
				}
			}
		}
		if (queue.length > component.length) component = queue;
	}
	const componentPoints = component.map((i) => cellPoint(mask, i));
	const nonExitPoints = componentPoints.filter((p) => !exitAt(p, scene.exits));
	const points = nonExitPoints.length ? nonExitPoints : componentPoints;
	const left = Math.min(...points.map((p) => p.x)),
		right = Math.max(...points.map((p) => p.x)),
		top = Math.min(...points.map((p) => p.y)),
		bottom = Math.min(940, Math.max(...points.map((p) => p.y))),
		mid = (left + right) / 2;
	const pick = (x: number, y: number) =>
		points.reduce((a, b) =>
			(b.x - x) ** 2 + (b.y - y) ** 2 < (a.x - x) ** 2 + (a.y - y) ** 2 ? b : a,
		);
	const nl = pick(left, bottom),
		nr = pick(right, bottom),
		fl = pick(left, top),
		fr = pick(right, top),
		deep = pick(mid, top),
		centre = pick(mid, (top + bottom) / 2);
	const beats: WalkBeat[] = [];
	const add = (
		name: string,
		start: Point,
		target: Point,
		extra: Partial<WalkBeat> = {},
	) =>
		beats.push({
			name,
			start: [start.x, start.y],
			click: [target.x, target.y],
			...extra,
		});
	add("near-left", nr, nl);
	add("near-right", nl, nr);
	add("deepest", pick(mid, bottom), deep);
	add("far-left", fr, fl);
	add("far-right", fl, fr);
	add("diagonal-away", nl, fr);
	add("diagonal-toward", fl, nr);
	let rear = false;
	for (const o of [...scene.objects]
		.filter((o) => !o.floorDecal)
		.sort((a, b) => b.bbox.w * b.bbox.h - a.bbox.w * a.bbox.h)
		.slice(0, 1)) {
		if (!o.baseline.length) continue;
		const candidates = points.filter(
			(p) =>
				p.x > o.bbox.x &&
				p.x < o.bbox.x + o.bbox.w &&
				p.y < baselineYAt(o, p.x) &&
				p.y > baselineYAt(o, p.x) - 100,
		);
		if (!candidates.length) continue;
		const leftBehind = candidates.reduce((a, b) => (b.x < a.x ? b : a));
		const rightBehind = candidates.reduce((a, b) => (b.x > a.x ? b : a));
		if (rightBehind.x - leftBehind.x < 40) continue;
		add("occluder-behind", leftBehind, rightBehind, { occluder: o.id });
		add("occluder-back", rightBehind, leftBehind, { occluder: o.id });
		rear = true;
		break;
	}
	if (!rear) {
		add("occluder-behind", centre, deep, {
			coverageFailure: "No reachable crossing behind the largest occluder",
		});
		add("occluder-back", deep, centre, {
			coverageFailure: "No reachable crossing behind the largest occluder",
		});
	}
	// Choose a narrow cell on a through-route, avoiding terminal extrema.
	const route = findPath(mask, nl, fr);
	let gap: Point | undefined,
		best = Infinity;
	for (const p of route.slice(1, -1)) {
		const i = nearestCell(mask, p),
			x = i % mask.width,
			y = Math.floor(i / mask.width);
		let radius = 0;
		for (; radius < Math.min(mask.width, mask.height); radius++) {
			if (
				x - radius < 0 ||
				x + radius >= mask.width ||
				y - radius < 0 ||
				y + radius >= mask.height ||
				!mask.data[y * mask.width + x - radius] ||
				!mask.data[y * mask.width + x + radius] ||
				!mask.data[(y - radius) * mask.width + x] ||
				!mask.data[(y + radius) * mask.width + x]
			)
				break;
		}
		if (radius < best) {
			best = radius;
			gap = p;
		}
	}
	if (gap) add("narrow-gap", pick(gap.x - 80, gap.y), pick(gap.x + 80, gap.y));
	else add("narrow-gap", nl, nr, { coverageFailure: "No corridor candidate" });
	add("unreachable", centre, { x: mid, y: Math.max(65, top - 180) });
	for (const [index, object] of scene.interactables.entries()) {
		const [x0, y0, x1, y1] = object.bounds;
		add(
			`object-${index}`,
			centre,
			{ x: (x0 + x1) * 960, y: (y0 + y1) * 540 },
			{ object: object.name },
		);
	}
	if (!scene.interactables.length)
		add("object", centre, centre, { coverageFailure: "No interactables" });
	for (const exit of scene.exits) {
		const n = exit.region.length;
		if (!n) continue;
		add(
			`exit-${exit.id}`,
			centre,
			{
				x: exit.region.reduce((sum, p) => sum + p.x, 0) / n,
				y: exit.region.reduce((sum, p) => sum + p.y, 0) / n,
			},
			{ exit: exit.id, expectedDestination: exit.to },
		);
	}
	return { place: scene.location, beats };
}
