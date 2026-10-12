import { cellPoint, findPath } from "../walkarea/navigation";
import type { WalkArea } from "../walkarea/types";

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
