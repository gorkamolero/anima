import type { WalkDirection } from "@anima/footfall";
import { HERMES_STAND_SHEETS, walkSheetFor } from "../hermesWalk";

/** The standing drawing for a direction: the walk sheet's feet-together frame. */
export function hermesStanding(direction: WalkDirection) {
	return walkSheetFor(HERMES_STAND_SHEETS, direction);
}
