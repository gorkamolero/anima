import type { WalkDirection } from "@anima/footfall";

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
				? "hermes-passing-stand-side"
				: `hermes-passing-stand-${suffix}`,
		flipX: direction === "right" || direction.endsWith("-left"),
	};
}
