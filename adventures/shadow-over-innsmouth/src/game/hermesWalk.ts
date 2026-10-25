import type { WalkDirection, WalkMotorOptions } from "@anima/footfall";

/**
 * Hermes' walk constants. The game reads them; the walk lab (`?lab=1&floor=1`)
 * starts from them and lets URL parameters override them for a look
 * (`stride`, `tempo`, `bob`, `mode`, `speed`, `sole=planted`). Pace was set by eye in the lab; the stride is the drawn one so the feet stay planted at every heading.
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
	awayDiagonal: "hermes-walk-away-right-v2-4x",
	towardDiagonal: "hermes-walk-toward-right-4x",
} as const;

/** Standing poses cut from each walk sheet's feet-together frame, so a stop or
 * a start is the same drawing the walk passes through: no cut. */
export const HERMES_STAND_SHEETS = {
	side: "hermes-stand-side",
	away: "hermes-stand-away",
	toward: "hermes-stand-toward",
	awayDiagonal: "hermes-stand-awayDiagonal",
	towardDiagonal: "hermes-stand-towardDiagonal",
} as const;

/** The sheet and mirror for a walking direction. */
export function hermesWalkSheet(direction: WalkDirection): {
	texture: string;
	flipX: boolean;
} {
	return walkSheetFor(HERMES_WALK_SHEETS, direction);
}

/** Sheet names a character built by `sprite-tools/scripts/make-character.mjs` ships
 * with: `<name>-walk-<direction>-4x` and `<name>-stand-<direction>`. */
export function characterWalkSheets(name: string) {
	const walk = (d: string) => `${name}-walk-${d}-4x`;
	const stand = (d: string) => `${name}-stand-${d}`;
	return {
		walk: {
			side: walk("side"),
			away: walk("away"),
			toward: walk("toward"),
			awayDiagonal: walk("awayDiagonal"),
			towardDiagonal: walk("towardDiagonal"),
		},
		stand: {
			side: stand("side"),
			away: stand("away"),
			toward: stand("toward"),
			awayDiagonal: stand("awayDiagonal"),
			towardDiagonal: stand("towardDiagonal"),
		},
	};
}

type SheetSet = ReturnType<typeof characterWalkSheets>["walk"];

/** The sheet and mirror for a direction, given a sheet set. */
export function walkSheetFor(
	sheets: SheetSet,
	direction: WalkDirection,
): { texture: string; flipX: boolean } {
	switch (direction) {
		case "left":
			return { texture: sheets.side, flipX: false };
		case "right":
			return { texture: sheets.side, flipX: true };
		case "away":
			return { texture: sheets.away, flipX: false };
		case "toward":
			return { texture: sheets.toward, flipX: false };
		case "away-right":
			return { texture: sheets.awayDiagonal, flipX: false };
		case "away-left":
			return { texture: sheets.awayDiagonal, flipX: true };
		case "toward-right":
			return { texture: sheets.towardDiagonal, flipX: false };
		case "toward-left":
			return { texture: sheets.towardDiagonal, flipX: true };
	}
}
