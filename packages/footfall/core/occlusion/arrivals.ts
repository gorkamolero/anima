import type { WalkDirection } from "../characters/walkHeading";
import type { Point } from "../walkarea/perspective";

export interface ArrivalMotor {
	heading: WalkDirection;
	target: Point;
	/** Ground point under the feet; preferred over the sprite origin for routing. */
	anchor?: Point;
	placeContact(point: Point): void;
	inwardStop(point: Point): Point | undefined;
}

import { cellPoint, findPath, nearestCell } from "../walkarea/navigation";
import type { WalkArea } from "../walkarea/types";
import type { Exit } from "./exits";

/** The extremal reachable floor row, with ties nearest the passage centre. */
export function passageArrival(
	area: WalkArea,
	approach: { x: number; y: number },
	kind: "near" | "far",
	maxY: number,
) {
	const mask = area.mask;
	const cells = mask.data.flatMap((v, i) =>
		v && cellPoint(mask, i).y <= maxY ? [i] : [],
	);
	cells.sort((a, b) => {
		const p = cellPoint(mask, a),
			q = cellPoint(mask, b);
		return (
			(kind === "far" ? p.y - q.y : q.y - p.y) ||
			Math.abs(p.x - approach.x) - Math.abs(q.x - approach.x)
		);
	});
	for (const cell of cells) {
		const point = cellPoint(mask, cell);
		const path = findPath(mask, approach, point);
		const end = path[path.length - 1];
		if (end && Math.hypot(end.x - point.x, end.y - point.y) < 1) return point;
	}
	throw new Error(`No reachable ${kind} passage floor`);
}

export function resolveReturnExit(
	area: WalkArea,
	exits: Exit[],
	connections: { to: string; entry: string; exit: string }[],
	travel: { from: string; exit: Exit },
	maxY: number,
) {
	let existing = connections.find(
		(c) => c.to === travel.from && c.entry === travel.exit.id,
	);
	const kind: Exit["kind"] =
		travel.exit.kind === "edge-left"
			? "edge-right"
			: travel.exit.kind === "edge-right"
				? "edge-left"
				: travel.exit.kind === "far"
					? "near"
					: travel.exit.kind === "near"
						? "far"
						: "door";
	let entry =
		exits.find((e) => e.id === existing?.exit) ??
		exits.find((e) => e.kind === kind && (!e.to || e.to === travel.from));
	if (!entry) {
		// Floor derivation can remove an old edge entrance. A unique surviving
		// connection to the source is authoritative even when the camera turns.
		const returns = exits.filter(
			(e) =>
				e.to === travel.from ||
				connections.some((c) => c.to === travel.from && c.exit === e.id),
		);
		if (returns.length === 1) {
			entry = returns[0];
			existing = connections.find(
				(c) => c.to === travel.from && c.exit === entry?.id,
			);
		}
	}
	if (!entry && kind === "near") {
		const cell = nearestCell(area.mask, { x: 960, y: maxY });
		const p = cellPoint(area.mask, cell);
		entry = {
			id: "near",
			kind: "near",
			approach: p,
			region: [
				{ x: p.x - 12, y: p.y - 8 },
				{ x: p.x + 12, y: p.y - 8 },
				{ x: p.x + 12, y: p.y + 8 },
				{ x: p.x - 12, y: p.y + 8 },
			],
		};
		exits.push(entry);
	}
	if (!entry) throw new Error(`No physical ${kind} return exit in destination`);
	return { existing, entry, kind: entry.kind };
}

/** Place at the actual return threshold and compute the inward walk. */
export function beginArrival(
	motor: ArrivalMotor,
	area: WalkArea,
	entry: Exit,
	kind: Exit["kind"],
	maxY: number,
) {
	const point = entry.approach
		? { ...entry.approach }
		: {
				x: entry.region.reduce((n, p) => n + p.x, 0) / entry.region.length,
				y: entry.region.reduce((n, p) => n + p.y, 0) / entry.region.length,
			};
	// Side arrivals put the planted sole on the literal image boundary,
	// facing inward. A rest pose's sprite origin can leave that sole off-floor.
	const edge = kind === "edge-left" || kind === "edge-right";
	if (edge) {
		const mask = area.clearanceMask ?? area.mask;
		const column = kind === "edge-left" ? 0 : mask.width - 1;
		const boundary = Array.from(
			{ length: mask.height },
			(_, row) => row * mask.width + column,
		)
			.filter((i) => mask.data[i])
			.sort(
				(a, b) =>
					Math.abs(cellPoint(mask, a).y - point.y) -
					Math.abs(cellPoint(mask, b).y - point.y),
			);
		if (!boundary.length)
			throw new Error("No walkable image boundary for edge arrival");
		point.y = cellPoint(mask, boundary[0]).y;
		point.x = kind === "edge-left" ? 0 : 1919.999;
	}
	if (kind === "near" || kind === "far") {
		Object.assign(point, passageArrival(area, point, kind, maxY));
	}
	motor.heading =
		kind === "near"
			? "away"
			: kind === "far"
				? "toward"
				: kind === "edge-left"
					? "right"
					: kind === "edge-right"
						? "left"
						: "toward";
	// A doorway approach is a floor contact too, not the sprite origin.
	// Snapping the origin leaves an elevated drawn boot above the threshold.
	if (!edge && kind !== "near" && kind !== "far")
		Object.assign(point, cellPoint(area.mask, nearestCell(area.mask, point)));
	motor.placeContact(point);

	const desired = {
		x:
			point.x + (kind === "edge-left" ? 400 : kind === "edge-right" ? -400 : 0),
		y:
			point.y +
			(edge ? 80 : kind === "near" ? -80 : kind === "far" ? 230 : 100),
	};
	const destination = edge ? (motor.inwardStop(desired) ?? desired) : desired;
	const path = findPath(area.mask, motor.anchor ?? motor.target, destination);
	return path;
}
