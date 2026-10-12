import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT } from "../lib/backgrounds.js";

const directory = resolve(ROOT, "api/data");
const ledger = resolve(directory, "calls.jsonl");
export function recordCall(kind: string, ms: number, cached = false): void {
	if (process.env.NODE_ENV === "test") return;
	mkdirSync(directory, { recursive: true });
	appendFileSync(
		ledger,
		`${JSON.stringify({ at: new Date().toISOString(), kind, ms, cached, brief: process.env.DERIVATION_BRIEF })}\n`,
	);
}
export function reserveCall(kind: "image" | "perception"): void {
	const entries = existsSync(ledger)
		? readFileSync(ledger, "utf8")
				.trim()
				.split("\n")
				.filter(Boolean)
				.map((line) => JSON.parse(line) as { kind: string; brief?: string })
		: [];
	if (
		kind === "image" &&
		process.env.DERIVATION_BRIEF === "08" &&
		entries.filter((e) => e.kind === "image-attempt" && e.brief === "08")
			.length >= 4
	)
		throw new Error("Brief 08 image budget exhausted (4 edits)");
	if (
		entries.filter((entry) => entry.kind === `${kind}-attempt`).length >=
		(kind === "image" ? 50 : 200)
	)
		throw new Error(`${kind} budget exhausted`);
	recordCall(`${kind}-attempt`, 0);
}
