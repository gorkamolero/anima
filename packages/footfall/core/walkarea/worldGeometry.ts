import type { Exit } from "../occlusion/exits";
import type { FloorMask } from "./types";

export type { FloorMask } from "./types";

/** Narrative travel must not rebind an exit already leading somewhere else. */
export function narrativeDeparture(
	exits: readonly Exit[],
	destination: string,
	defaultKind: Exit["kind"],
): Exit | undefined {
	return (
		exits.find((exit) => exit.to === destination) ??
		exits.find((exit) => exit.kind === defaultKind && !exit.to)
	);
}

// Clip cached floor geometry above captions after footprint erosion.
export function clipFloorBelow(mask: FloorMask, maxY: number): FloorMask {
	const lastRow = Math.floor((maxY * mask.height) / 1080 - 0.5);
	return {
		...mask,
		data: mask.data.map((v, i) =>
			Math.floor(i / mask.width) > lastRow ? 0 : v,
		),
	};
}
