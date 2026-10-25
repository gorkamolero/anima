import type { FootAnimation, FootCycle, FootPose } from "@anima/footfall";
import { facingFlip, hermesWalkSheet } from "../hermesWalk";
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
			const drawn = cycle(texture);
			return { cycle: drawn, flipX: facingFlip(drawn, flipX) };
		},
		standing(direction) {
			const { texture, flipX } = hermesStanding(direction);
			const drawn = cycle(texture);
			return { cycle: drawn, frame: 0, flipX: facingFlip(drawn, flipX) };
		},
	};
}
