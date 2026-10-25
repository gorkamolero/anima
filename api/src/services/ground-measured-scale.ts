import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { proofDirectory } from "./ground-perception.js";

/** Ground scale measured from a known-size object in the painting by an agent
 * that runs a script over the pixels, instead of a vision model eyeballing a
 * rectangle. Doors are the only reference accepted: props of variable size
 * (gravestones, crates, barrels) gave answers a third off in the comparison
 * of 25 Oct 2026, where MoGe was right. This path exists for paintings with a
 * door when the depth model is unavailable. */

const BRIEF = `You are given one painted background for a 2D point-and-click adventure game, 1920x1080 px (the file may be smaller; scale every coordinate you report to 1920x1080). The file is on disk at the path named at the end: run Python (\`uv run --with pillow --with numpy python3\`) to measure pixel positions precisely. Do not modify any file in the repository and do not commit.

Task: estimate the ground perspective so a 1.75 m adult can be drawn at the right size anywhere on the floor.

1. Find the horizon: the screen row (y in px, 0 at the top) where the ground plane vanishes, from receding edges (road sides, wall bases, window rows, cobbles).
2. Find every door or doorway standing on the floor (real height about 2.03 m for the opening). For each give: label, bottom y (where it meets the floor), top y, pixel height, assumed real height. Measure the opening, not the frame. If there is no door, say so in the references list (empty) and still report the horizon.
3. From the doors, give the height in px of a 1.75 m adult whose feet are at y = 700, 850 and 1000, with the model height_px = k * (feet_y - horizon_y); report k.
4. State the camera height above the floor in metres that this implies.

Answer ONLY with a JSON object on the last line:
{"horizon_y": number, "k": number, "camera_height_m": number, "adult_px": {"700": n, "850": n, "1000": n}, "references": [{"label": "...", "bottom_y": n, "top_y": n, "px": n, "real_m": n}], "notes": "one or two sentences"}`;

export interface MeasuredScale {
	horizonY: number;
	slope: number;
	cameraHeightM: number;
	references: {
		label: string;
		bottom_y: number;
		top_y: number;
		px: number;
		real_m: number;
	}[];
	notes: string;
	raw: string;
}

const HERMES_DRAWN_PX = 1059 * 0.5;

export async function measureScaleWithCodex(
	image: string,
	key: string,
	root = resolve(process.cwd(), ".."),
): Promise<MeasuredScale> {
	const prompt = `${BRIEF}\n\nImage path on disk: ${image}`;
	const out = resolve(proofDirectory(key), "measured-scale.codex.txt");
	await mkdir(proofDirectory(key), { recursive: true });
	const raw = await new Promise<string>((done, fail) => {
		const child = spawn(
			"codex",
			[
				"exec",
				"--skip-git-repo-check",
				"--dangerously-bypass-approvals-and-sandbox",
				"-C",
				root,
				"-i",
				image,
				"-o",
				out,
				"-",
			],
			{ stdio: ["pipe", "ignore", "pipe"] },
		);
		let err = "";
		child.stderr.on("data", (d) => {
			err += String(d);
		});
		child.on("error", fail);
		child.on("close", async (code) => {
			if (code !== 0) return fail(new Error(`codex exited ${code}: ${err.slice(-400)}`));
			const { readFile } = await import("node:fs/promises");
			done(await readFile(out, "utf8"));
		});
		child.stdin.end(prompt);
	});
	const line = raw
		.trim()
		.split("\n")
		.reverse()
		.find((l) => l.trim().startsWith("{"));
	if (!line) throw new Error("No JSON answer from the measurer");
	const parsed = JSON.parse(line) as {
		horizon_y: number;
		k: number;
		camera_height_m: number;
		references: MeasuredScale["references"];
		notes: string;
	};
	// The brief asks for doors only; the label is free text ("foreground left").
	const doors = (parsed.references ?? []).filter(
		(r) =>
			r.real_m >= 1.9 &&
			r.real_m <= 2.2 &&
			r.px > 120 &&
			r.bottom_y > parsed.horizon_y + 60,
	);
	if (!doors.length)
		throw new Error(
			"No door in the painting to measure against; scale left unchanged",
		);
	// One adult per door, then the slope is the mean of k = adult_px / (foot - horizon).
	const ks = doors.map(
		(d) => ((d.px * 1.75) / d.real_m) / (d.bottom_y - parsed.horizon_y),
	);
	const k = ks.reduce((a, b) => a + b, 0) / ks.length;
	if (!(k > 0.3 && k < 4)) throw new Error(`Implausible scale k=${k}`);
	return {
		horizonY: parsed.horizon_y,
		slope: k / HERMES_DRAWN_PX,
		cameraHeightM: parsed.camera_height_m,
		references: doors,
		notes: parsed.notes,
		raw: line,
	};
}

/** Apply a measured horizon and slope to a stored ground record. */
export function applyMeasuredScale<
	T extends {
		horizonY: number;
		scaleSlope: number;
		groundLine: { points: { x: number; y: number; scaleFactor: number }[] };
		walkArea?: { perspective: { horizonY: number; slope: number } };
		notes?: string[];
	},
>(ground: T, measured: MeasuredScale): T {
	const scaleAt = (y: number) =>
		Math.max(0.05, measured.slope * (y - measured.horizonY));
	const walkArea = ground.walkArea
		? {
				...ground.walkArea,
				perspective: {
					...ground.walkArea.perspective,
					horizonY: measured.horizonY,
					slope: measured.slope,
				},
			}
		: undefined;
	return {
		...ground,
		horizonY: measured.horizonY,
		scaleSlope: measured.slope,
		groundLine: {
			...ground.groundLine,
			points: ground.groundLine.points.map((p) => ({
				...p,
				scaleFactor: scaleAt(p.y),
			})),
		},
		...(walkArea ? { walkArea } : {}),
		notes: [
			...(ground.notes ?? []),
			`Scale re-measured from ${measured.references.map((r) => r.label).join(", ")} (${measured.references.map((r) => `${r.px}px = ${r.real_m}m`).join(", ")}); camera ${measured.cameraHeightM.toFixed(2)} m.`,
		],
	};
}

export async function recordMeasuredScale(key: string, measured: MeasuredScale, before: unknown, after: unknown) {
	await writeFile(
		resolve(proofDirectory(key), "measured-scale.json"),
		JSON.stringify({ measured, before, after, date: new Date().toISOString() }, null, 2),
	);
}
