import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT } from "../lib/backgrounds.js";

const directory = resolve(ROOT, "api/data");
const ledger = resolve(directory, "calls.jsonl");
export function recordCall(kind: string, ms: number, cached = false): void {
	mkdirSync(directory, { recursive: true });
	appendFileSync(
		ledger,
		`${JSON.stringify({ at: new Date().toISOString(), kind, ms, cached })}\n`,
	);
}
export function reserveCall(kind: "image" | "perception"): void {
	const entries = existsSync(ledger)
		? readFileSync(ledger, "utf8")
				.trim()
				.split("\n")
				.filter(Boolean)
				.map((line) => JSON.parse(line) as { kind: string })
		: [];
	if (
		entries.filter((entry) => entry.kind === `${kind}-attempt`).length >=
		(kind === "image" ? 50 : 200)
	)
		throw new Error(`${kind} budget exhausted`);
	recordCall(`${kind}-attempt`, 0);
}
