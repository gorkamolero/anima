import type { WalkMotorOptions } from "@anima/footfall";

/**
 * Hermes' walk constants. The game reads them; the walk lab (`?lab=1&floor=1`)
 * starts from them and lets URL parameters override them for a look
 * (`stride`, `tempo`, `bob`, `mode`, `speed`). Values were set by eye in the lab.
 */
export const HERMES_WALK: WalkMotorOptions = {
	gait: {
		/** Stride length as a multiple of the stride the side sheet draws. */
		strideScale: 1.47,
		/** Full strides (two steps) per second. */
		stridesPerSecond: 0.85,
	},
	/** Share of the stride's pendulum drop that reaches the torso (0 to 1). */
	verticalBob: 0.5,
	bobMode: "pendulum",
};
