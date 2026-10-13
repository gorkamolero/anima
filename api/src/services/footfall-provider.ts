import type { DerivationProvider } from "@anima/footfall/derive/index";
import { deriveGround } from "./ground.js";
import { deriveOccluders } from "./occluders.js";
/** The existing cached fal-backed implementation, with unchanged entry points. */
export const footfallProvider = {
	deriveGround,
	deriveOccluders,
} satisfies DerivationProvider;
