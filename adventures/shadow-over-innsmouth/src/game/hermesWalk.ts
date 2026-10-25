import type { WalkDirection, WalkMotorOptions } from "@anima/footfall";

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

/**
 * Walk sheets by drawn direction. Side and diagonal sheets are drawn facing
 * one way and mirrored for the other; depth sheets are symmetric. Each name
 * is a 4x motion-interpolated sheet that has passed the drift and step audits
 * (`sprite-factory.py audit-drift` / `audit-steps`).
 */
export const HERMES_WALK_SHEETS = {
	side: "hermes-walk-side-v2-4x",
	away: "hermes-walk-away-4x",
	toward: "hermes-walk-toward-4x",
	awayDiagonal: "hermes-walk-away-right-4x",
	towardDiagonal: "hermes-walk-toward-right-4x",
} as const;

/** The sheet and mirror for a walking direction. */
export function hermesWalkSheet(direction: WalkDirection): {
	texture: string;
	flipX: boolean;
} {
	const s = HERMES_WALK_SHEETS;
	switch (direction) {
		case "left":
			return { texture: s.side, flipX: false };
		case "right":
			return { texture: s.side, flipX: true };
		case "away":
			return { texture: s.away, flipX: false };
		case "toward":
			return { texture: s.toward, flipX: false };
		case "away-right":
			return { texture: s.awayDiagonal, flipX: false };
		case "away-left":
			return { texture: s.awayDiagonal, flipX: true };
		case "toward-right":
			return { texture: s.towardDiagonal, flipX: false };
		case "toward-left":
			return { texture: s.towardDiagonal, flipX: true };
	}
}
