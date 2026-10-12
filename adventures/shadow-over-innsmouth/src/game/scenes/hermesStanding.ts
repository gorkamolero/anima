import type { WalkDirection } from "@anima/engine";

/** Side artwork faces left; the diagonal originals face right. */
export function hermesStanding(direction: WalkDirection) {
	const suffix = direction.startsWith("away-")
		? "away-right"
		: direction.startsWith("toward-")
			? "toward-right"
			: direction;
	return {
		texture:
			direction === "left" || direction === "right"
				? "hermes-matched-stand-side"
				: `hermes-matched-stand-${suffix}`,
		flipX: direction === "right" || direction.endsWith("-left"),
	};
}
