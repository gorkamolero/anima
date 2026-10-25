import type { FootAnimation, FootCycle, FootPose } from "@anima/footfall";
import { hermesWalkSheet } from "../hermesWalk";
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
			const { texture, flipX } = hermesWalkSheet(direction);
			return { cycle: cycle(texture), flipX };
		},
		standing(direction) {
			const { texture, flipX } = hermesStanding(direction);
			return { cycle: cycle(texture), frame: 0, flipX };
		},
	};
}
