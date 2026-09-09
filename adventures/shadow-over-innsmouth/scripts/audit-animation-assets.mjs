import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const outputDir = resolve(repoRoot, "tmp", "animation-assets");
const manifestPath = resolve(
	packageRoot,
	process.argv.find((arg) => arg.endsWith(".json")) ??
		"animation-assets/review-scene-characters.json",
);
const strictFinal = process.argv.includes("--strict-final");

mkdirSync(outputDir, { recursive: true });

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

function push(checks, name, pass, details = undefined) {
	checks.push({ name, pass, details });
}

const manifest = readJson(manifestPath);
const checks = [];

push(checks, "manifest exists", existsSync(manifestPath), {
	manifestPath,
});
push(
	checks,
	"manifest has characters",
	Array.isArray(manifest.characters) && manifest.characters.length > 0,
	{ count: manifest.characters?.length ?? 0 },
);

for (const character of manifest.characters ?? []) {
	const requiredStates = character.requiredStates ?? [];
	push(
		checks,
		`${character.id} declares required animation states`,
		requiredStates.length > 0,
		{ requiredStates },
	);

	for (const state of requiredStates) {
		const stateConfig = character.states?.[state];
		push(
			checks,
			`${character.id}.${state} is configured`,
			Boolean(stateConfig),
			{
				state,
			},
		);
		if (!stateConfig) continue;

		const imagePath = resolve(packageRoot, stateConfig.image);
		push(
			checks,
			`${character.id}.${state} image exists`,
			existsSync(imagePath),
			{
				image: stateConfig.image,
			},
		);

		if (stateConfig.metadata) {
			const metadataPath = resolve(packageRoot, stateConfig.metadata);
			const metadataExists = existsSync(metadataPath);
			push(checks, `${character.id}.${state} metadata exists`, metadataExists, {
				metadata: stateConfig.metadata,
			});
			if (metadataExists) {
				const metadata = readJson(metadataPath);
				const frameCount = Number(metadata.frameCount ?? 0);
				const end = Number(stateConfig.frames?.end ?? -1);
				push(
					checks,
					`${character.id}.${state} frame range fits metadata`,
					end >= 0 && end < frameCount,
					{ end, frameCount },
				);
			}
		}

		push(
			checks,
			`${character.id}.${state} has a positive frame rate`,
			Number(stateConfig.frameRate) > 0,
			{ frameRate: stateConfig.frameRate },
		);

		const status = stateConfig.status ?? "unknown";
		push(
			checks,
			`${character.id}.${state} final asset status`,
			!strictFinal || status !== "fallback",
			{ status, strictFinal },
		);
	}
}

const failed = checks.filter((check) => !check.pass);
const fallbackStates = [];
for (const character of manifest.characters ?? []) {
	for (const [state, config] of Object.entries(character.states ?? {})) {
		if (config.status === "fallback") {
			fallbackStates.push(`${character.id}.${state}`);
		}
	}
}

const report = {
	manifest: manifestPath,
	generatedAt: new Date().toISOString(),
	strictFinal,
	checks,
	fallbackStates,
	pass: failed.length === 0,
};

writeFileSync(
	resolve(outputDir, "animation-assets-audit.json"),
	`${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));

if (failed.length > 0) {
	process.exitCode = 1;
}
