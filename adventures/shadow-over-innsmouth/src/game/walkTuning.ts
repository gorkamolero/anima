import type { WalkMotorOptions } from "@anima/footfall";

/**
 * Hermes' walk, as tuned by eye in the walk lab (`?lab=1&floor=1`).
 * This is the single source of truth: the game reads it, and the lab starts
 * from it and lets URL parameters override it while experimenting
 * (`stride`, `tempo`, `bob`, `mode`, `speed`). Change the values here to
 * change the game.
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
