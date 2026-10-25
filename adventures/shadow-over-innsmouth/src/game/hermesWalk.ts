import type { WalkMotorOptions } from "@anima/footfall";

/**
 * Hermes' walk constants. The game reads them; the walk lab (`?lab=1&floor=1`)
 * starts from them and lets URL parameters override them for a look
 * (`stride`, `tempo`, `bob`, `mode`, `speed`). Pace was set by eye in the lab; the stride is the drawn one so the feet stay planted at every heading.
 */
export const HERMES_WALK: WalkMotorOptions = {
	gait: {
		/** Stride length as a multiple of the stride the side sheet draws.
		 * 1 keeps the feet planted; anything else makes them slide by that much. */
		strideScale: 1,
		/** Full strides (two steps) per second. A brisk walk. */
		stridesPerSecond: 1,
	},
	/** Share of the stride's pendulum drop that reaches the torso (0 to 1). */
	verticalBob: 0.5,
	bobMode: "pendulum",
};
