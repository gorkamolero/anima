import type { Foot, FootCycle } from "../core/characters/footLock";
import { GROUND_SECTORS } from "../core/characters/walkHeading";
import { floorPixel } from "../core/occlusion/bridge";
import type { Point } from "../core/walkarea/perspective";
import type { WalkArea } from "../core/walkarea/types";

export interface FrameLog {
	x: number;
	y: number;
	scale: number;
	texture: string;
	frame: number;
	flip: boolean;
	visible?: boolean;
	walking?: boolean;
	location?: string;
	contact: {
		heading?: string;
		anchor: Point;
		ground: Point;
		arrival?: { target: Point; anchor: Point };
	};
}
export type SheetLookup = (texture: string) => FootCycle;
export interface GeometryLog {
	area: WalkArea;
	areas?: Record<string, WalkArea>;
}
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const areaAt = (geometry: GeometryLog, row: FrameLog) =>
	geometry.areas?.[row.location ?? ""] ?? geometry.area;
/** Project an authored sole independently of motor anchor values. */
export function screenContact(
	row: FrameLog,
	foot: Foot,
	metadata: SheetLookup,
): Point {
	const m = metadata(row.texture),
		c = m.contacts[row.frame];
	return {
		x: row.x + (c[foot].x - m.frameWidth / 2) * row.scale * (row.flip ? -1 : 1),
		y: row.y + (c[foot].y - m.frameHeight) * row.scale,
	};
}
/** Test the drawing's support sole against floor and objects. */
export function checkFloor(
	rows: readonly FrameLog[],
	geometry: GeometryLog,
	metadata: SheetLookup,
) {
	const offFloor: number[] = [],
		objectContacts: number[] = [];
	rows.forEach((row, i) => {
		if (row.visible === false) return;
		const m = metadata(row.texture),
			c = m.contacts?.[row.frame];
		if (!c) return;
		if (geometry.areas && !geometry.areas[row.location ?? ""])
			throw new Error(`Missing floor for ${row.location}`);
		const point = screenContact(row, c.planted, metadata),
			area = areaAt(geometry, row);
		if (!floorPixel(area.mask, point.x, point.y)) offFloor.push(i);
		if (
			area.objectFootprints &&
			floorPixel(area.objectFootprints, point.x, point.y)
		)
			objectContacts.push(i);
	});
	return {
		pass: !offFloor.length && !objectContacts.length,
		offFloor,
		objectContacts,
	};
}
/** Reviewer scalecheck prediction (independent of production scaleAt). */
function prediction(area: WalkArea, point: Point) {
	const p = area.perspective,
		r = p.residual ?? [];
	let k = 1;
	if (r.length) {
		k = r[0].k;
		if (point.x >= r[r.length - 1].x) k = r[r.length - 1].k;
		else if (point.x > r[0].x)
			for (let i = 1; i < r.length; i++)
				if (point.x <= r[i].x) {
					const a = r[i - 1],
						b = r[i];
					k = a.k + ((b.k - a.k) * (point.x - a.x)) / (b.x - a.x);
					break;
				}
	}
	const s = (p.constant ?? p.slope * (point.y - p.horizonY)) * k;
	return (
		area.baseScale *
		Math.max(area.scaleClamp.min, Math.min(area.scaleClamp.max, s))
	);
}
export function checkScale(
	rows: readonly FrameLog[],
	geometry: GeometryLog,
	metadata?: SheetLookup,
	reference?: FootCycle,
) {
	const flagged: number[] = [],
		errors: number[] = [],
		soles: number[] = [];
	rows.forEach((r, i) => {
		if (r.visible === false) return;
		const a = areaAt(geometry, r),
			height = metadata?.(r.texture).drawnHeight,
			normalisation =
				height && reference?.drawnHeight ? reference.drawnHeight / height : 1,
			e = Math.abs(
				r.scale / (prediction(a, r.contact.anchor) * normalisation) - 1,
			);
		errors.push(e);
		soles.push(r.contact?.anchor ? e : 0);
		if (e > 0.01 + 1e-8) flagged.push(i);
	});
	return {
		pass: !flagged.length,
		flagged,
		maxRelativeError: Math.max(0, ...errors),
		maxPlantedSoleRelativeError: Math.max(0, ...soles),
		threshold: 0.01,
	};
}
/** Compare consecutive walking frames in ground space. */
export function checkFacing(
	rows: readonly FrameLog[],
	corners = 0,
	geometry?: GeometryLog,
) {
	const stances: FrameLog[][] = [];
	for (let i = 1; i < rows.length; i++) {
		const a = rows[i - 1],
			b = rows[i];
		if (
			a.walking &&
			b.walking &&
			a.location === b.location &&
			a.contact.heading === b.contact.heading
		)
			stances.push([a, b]);
	}
	let n = 0,
		reversals = 0;
	const runs: { heading: string; stances: number }[] = [],
		offStances: {
			stanceStartFrame: number;
			heading: string;
			offDeg: number;
		}[] = [];
	const sector = (heading: string) =>
		GROUND_SECTORS.indexOf(heading as (typeof GROUND_SECTORS)[number]);
	for (const s of stances) {
		const a = s[0],
			b = s[s.length - 1],
			ga = a.contact.ground,
			gb = b.contact.ground,
			dx = gb.x - ga.x,
			p = geometry && areaAt(geometry, a).perspective,
			dz =
				p && (p.constant !== undefined || !p.slope) ? ga.y - gb.y : gb.y - ga.y,
			heading = a.contact.heading as string;
		if (Math.hypot(dx, dz) < 1e-8) continue;
		if (runs.at(-1)?.heading === heading) runs[runs.length - 1].stances++;
		else runs.push({ heading, stances: 1 });
		n++;
		const angle = Math.atan2(dz, dx),
			expected = (sector(heading) * Math.PI) / 4,
			d = Math.abs(
				Math.atan2(Math.sin(angle - expected), Math.cos(angle - expected)),
			);
		if (d > Math.PI / 6)
			offStances.push({
				stanceStartFrame: rows.indexOf(a),
				heading,
				offDeg: Math.round(((d * 180) / Math.PI) * 10) / 10,
			});
	}
	const flicker = runs.slice(1, -1).filter((r) => r.stances < 2).length;
	for (let i = 1; i < runs.length; i++) {
		const d =
			Math.abs(sector(runs[i - 1].heading) - sector(runs[i].heading)) % 8;
		if (Math.min(d, 8 - d) * 45 > 120) reversals++;
	}
	const headingChanges = runs.length - 1,
		changeLimit = 2 + 2 * corners,
		agreement = 1 - offStances.length / Math.max(1, n);
	return {
		pass:
			n > 0 &&
			agreement >= 0.95 &&
			!flicker &&
			!reversals &&
			headingChanges <= changeLimit,
		stances: n,
		agreement: Math.round(agreement * 1000) / 1000,
		offStances: offStances.slice(0, 8),
		runs,
		flicker,
		reversals,
		headingChanges,
		changeLimit,
	};
}
/** Completed walks reach the exact navigation endpoint; scene transfers are separate. */
export function checkArrival(rows: readonly FrameLog[]) {
	const end = rows.filter((r) => r.contact.arrival).at(-1);
	if (!end) return { status: "unmeasured" as const };
	if (end.location !== (rows.find((r) => r.walking)?.location ?? end.location))
		return { status: "exit" as const };
	const arrival = end.contact.arrival as NonNullable<
		FrameLog["contact"]["arrival"]
	>;
	const distance = dist(arrival.anchor, arrival.target);
	return {
		status: distance <= 1e-6 ? ("arrived" as const) : ("far" as const),
		distance,
	};
}
export interface DepthFrame extends FrameLog {
	depth: number;
	occluders: {
		id: string;
		depth: number;
		floorDecal?: boolean;
		baseline: Point[];
		bounds: { x: number; y: number; width: number; height: number };
	}[];
}
/** draworder.py broad-phase/depth check. The adapter supplies exact alpha intersection. */
export function checkDrawOrder(
	rows: readonly DepthFrame[],
	metadata: SheetLookup,
	overlaps: (
		row: DepthFrame,
		object: DepthFrame["occluders"][number],
	) => boolean,
) {
	const flagged: { frame: number; object: string }[] = [],
		crossings: { frame: number; object: string }[] = [];
	const previous = new Map<string, boolean>();
	let checked = 0;
	rows.forEach((row, frame) => {
		if (row.visible === false) return;
		const m = metadata(row.texture),
			left = row.x - (m.frameWidth * row.scale) / 2,
			top = row.y - m.frameHeight * row.scale;
		for (const o of row.occluders) {
			const b = o.bounds;
			if (!o.baseline.length) continue;
			const overlap = !(
				left >= b.x + b.width ||
				left + m.frameWidth * row.scale <= b.x ||
				top >= b.y + b.height ||
				row.y <= b.y ||
				!overlaps(row, o)
			);
			const points = [...o.baseline].sort((a, b) => a.x - b.x),
				x = row.contact.anchor.x;
			let baseline = points[points.length - 1].y;
			if (x <= points[0].x) baseline = points[0].y;
			else
				for (let i = 1; i < points.length; i++)
					if (x <= points[i].x) {
						const a = points[i - 1],
							b = points[i];
						baseline =
							a.y + ((b.y - a.y) * (x - a.x)) / Math.max(1e-9, b.x - a.x);
						break;
					}
			const behind = !o.floorDecal && row.contact.anchor.y < baseline;
			if (overlap) {
				checked++;
				if (behind !== row.depth < o.depth)
					flagged.push({ frame, object: o.id });
			}
			const key = `${row.location}/${o.id}`;
			if (overlap && previous.has(key) && previous.get(key) !== behind)
				crossings.push({ frame, object: o.id });
			previous.set(key, behind);
		}
	});
	return { pass: !flagged.length, checked, flagged, crossings };
}
/** Path bar against an independently calculated shortest octilinear route. */
export function checkPath(
	rows: readonly FrameLog[],
	shortestOctilinearMetres: number,
) {
	const walking = rows.filter((r) => r.walking);
	let length = 0;
	for (let i = 1; i < walking.length; i++)
		if (walking[i].location === walking[i - 1].location)
			length += dist(walking[i - 1].contact.ground, walking[i].contact.ground);
	const ratio =
		shortestOctilinearMetres > 0
			? length / shortestOctilinearMetres
			: length === 0
				? 1
				: Infinity;
	return { pass: ratio <= 1.05, length, shortestOctilinearMetres, ratio };
}
export function checkExits(
	events: readonly { type: string; data?: { id?: string; to?: string } }[],
	expectedId: string,
	expectedDestination?: string,
) {
	const triggers = events.filter((e) => e.type === "triggerExit");
	return {
		pass:
			triggers.length === 1 &&
			triggers[0].data?.id === expectedId &&
			(!expectedDestination || triggers[0].data?.to === expectedDestination),
		count: triggers.length,
	};
}
/** Feed hashes of rendered frames, not telemetry: unchanged transforms are not frozen video. */
export function checkFrozenFrames(
	hashes: readonly string[],
	walking: readonly boolean[],
) {
	const flagged: number[] = [];
	for (let i = 1; i < hashes.length; i++)
		if (walking[i] && walking[i - 1] && hashes[i] === hashes[i - 1])
			flagged.push(i);
	return { pass: !flagged.length, flagged };
}
