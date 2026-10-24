import type { FootAnimation, FootCycle, FootPose } from "@anima/footfall";
import { hermesStanding } from "./hermesStanding";

/** The renderer supplies only asset lookup and pose display. */
export function hermesFootAnimation(
	cycle: (texture: string) => FootCycle,
	current: () => FootPose,
	show: (pose: FootPose) => void,
): FootAnimation {
	return {
		current,
		show,
		select(direction) {
			const suffix = direction.startsWith("away-")
				? "away-right"
				: direction.startsWith("toward-")
					? "toward-right"
					: direction;
			const texture =
				direction === "left" || direction === "right"
					? "hermes-fal-veo-transparent-loop-4x"
					: `hermes-walk-${suffix}-4x`;
			return {
				cycle: cycle(texture),
				flipX: direction === "right" || direction.endsWith("-left"),
			};
		},
		standing(direction) {
			const { texture, flipX } = hermesStanding(direction);
			return { cycle: cycle(texture), frame: 0, flipX };
		},
	};
}
