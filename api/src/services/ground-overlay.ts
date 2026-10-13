import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { imagePath } from "../lib/backgrounds.js";
import type { Exit } from "./exits.js";
import type { GroundData } from "./ground.js";
import { proofDirectory, proofRoot } from "./ground-perception.js";
import type { Occluder } from "./occluders.js";

export async function groundOverlay(
	image: string,
	ground: GroundData,
	key: string,
	occluders: Occluder[] = [],
	exits: Exit[] = [],
) {
	await mkdir(proofDirectory(key), { recursive: true });
	const floor = ground.floor;
	const rects = floor.data
		.flatMap((v, i) =>
			v
				? [
						`<rect x="${((i % floor.width) * 1920) / floor.width}" y="${(Math.floor(i / floor.width) * 1080) / floor.height}" width="${1920 / floor.width}" height="${1080 / floor.height}"/>`,
					]
				: [],
		)
		.join("");
	const points = (p: Array<{ x: number; y: number }>) =>
		p.map((v) => `${v.x},${v.y}`).join(" ");
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><g fill="#00ff66" opacity="0.3">${rects}</g><g fill="none" stroke-width="3"><path stroke="#ffff00" d="M0 ${ground.horizonY} H1920"/><polyline stroke="#ff3388" points="${points(ground.groundLine.points)}"/>${(ground.regions ?? []).map((r) => `<polygon stroke="#00dfff" stroke-dasharray="8 6" points="${points(r.polygon)}"/>`).join("")}${occluders.map((o) => `<polyline stroke="${o.floorDecal ? "#bb66ff" : "#ff8800"}" stroke-width="5" points="${points(o.baseline)}"/>`).join("")}${exits.map((e) => `<polygon fill="#4466ff" fill-opacity="0.4" stroke="#6688ff" points="${points(e.region)}"/>`).join("")}</g></svg>`;
	const svgPath = resolve(proofDirectory(key), "overlay.svg");
	await writeFile(svgPath, svg);
	const path = resolve(
		proofRoot,
		`${key.replace(/[^a-zA-Z0-9_-]/g, "_")}-overlay.png`,
	);
	const maskPath = resolve(proofDirectory(key), "floor-tint.png");
	execFileSync(
		"magick",
		[
			"-size",
			`${floor.width}x${floor.height}`,
			"-depth",
			"8",
			"rgba:-",
			"-filter",
			"point",
			"-resize",
			"1920x1080!",
			maskPath,
		],
		{
			input: Buffer.from(floor.data.flatMap((v) => [0, 255, 102, v ? 85 : 0])),
		},
	);
	const draw: string[] = [
		"-fill",
		"none",
		"-strokewidth",
		"3",
		"-stroke",
		"yellow",
		"-draw",
		`line 0,${ground.horizonY} 1920,${ground.horizonY}`,
	];
	if (ground.groundLine.points.length > 1)
		draw.push(
			"-stroke",
			"#ff3388",
			"-draw",
			`polyline ${points(ground.groundLine.points)}`,
		);
	for (const r of ground.regions ?? [])
		draw.push("-stroke", "#00dfff", "-draw", `polygon ${points(r.polygon)}`);
	for (const o of occluders)
		if (o.baseline.length > 1)
			draw.push(
				"-stroke",
				o.floorDecal ? "#bb66ff" : "#ff8800",
				"-strokewidth",
				"5",
				"-draw",
				`polyline ${points(o.baseline)}`,
			);
	for (const e of exits)
		draw.push("-stroke", "#6688ff", "-draw", `polygon ${points(e.region)}`);
	execFileSync("magick", [
		imagePath(image),
		"-resize",
		"1920x1080!",
		maskPath,
		"-composite",
		...draw,
		path,
	]);

	return path;
}

export async function groundMaskReview(
	image: string,
	ground: GroundData,
	key: string,
): Promise<string> {
	const out = proofDirectory(key);
	await mkdir(out, { recursive: true });
	const tint = resolve(out, "mask-review-tint.png");
	execFileSync(
		"magick",
		[
			"-size",
			`${ground.floor.width}x${ground.floor.height}`,
			"-depth",
			"8",
			"rgba:-",
			"-filter",
			"point",
			"-resize",
			"1920x1080!",
			tint,
		],
		{
			input: Buffer.from(
				// Opaque eligibility pixels prevent scene texture from obscuring mask membership.
				ground.floor.data.flatMap((v) => [0, 255, 0, v ? 255 : 0]),
			),
		},
	);
	const path = resolve(out, `mask-review-${Date.now()}.png`);
	execFileSync("magick", [
		imagePath(image),
		"-resize",
		"1920x1080!",
		"-colorspace",
		"gray",
		"-colorspace",
		"sRGB",
		tint,
		"-composite",
		path,
	]);
	return path;
}
