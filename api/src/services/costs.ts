import { appendFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT } from "../lib/backgrounds.js";

const directory = resolve(ROOT, "api/data");
const ledger = resolve(directory, "calls.jsonl");
export function recordCall(kind: string, ms: number, cached = false): void {
	if (process.env.NODE_ENV === "test") return;
	mkdirSync(directory, { recursive: true });
	appendFileSync(
		ledger,
		`${JSON.stringify({ at: new Date().toISOString(), kind, ms, cached })}\n`,
	);
}

export type PaidCallKind = "image" | "perception" | "segmentation" | "decision";
const LIMIT_ENV: Record<PaidCallKind, string> = {
	image: "MAX_IMAGE_CALLS",
	perception: "MAX_PERCEPTION_CALLS",
	segmentation: "MAX_SEGMENTATION_CALLS",
	decision: "MAX_DECISION_CALLS",
};
const spent: Record<PaidCallKind, number> = {
	image: 0,
	perception: 0,
	segmentation: 0,
	decision: 0,
};
/** Spending guard for QA and development runs. Limits are optional, per process,
 * and set by environment (e.g. MAX_SEGMENTATION_CALLS=40); unset means no limit.
 * Never a stored cumulative counter: a past run must not block a player's scene. */
export function reserveCall(kind: PaidCallKind): void {
	const raw = process.env[LIMIT_ENV[kind]];
	const limit = raw === undefined || raw === "" ? Infinity : Number(raw);
	if (spent[kind] >= limit)
		throw new Error(`${kind} call limit reached (${LIMIT_ENV[kind]}=${raw})`);
	spent[kind]++;
	recordCall(`${kind}-attempt`, 0);
}
/** Test hook. */
export function resetCallLimits(): void {
	for (const kind of Object.keys(spent) as PaidCallKind[]) spent[kind] = 0;
}
