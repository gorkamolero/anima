import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const outputDir = resolve(repoRoot, "tmp");
const url = process.argv[2] ?? "http://localhost:8080/";

mkdirSync(outputDir, { recursive: true });

const checks = [];

const placementManifests = [
	"placement-calibration/hermes-terminal-flat-exterior.json",
	"placement-calibration/hermes-depot-interior.json",
].map((path) => JSON.parse(readFileSync(resolve(packageRoot, path), "utf8")));

function runAgentBrowser(args, options = {}) {
	const result = spawnSync("agent-browser", ["--session", "anima", ...args], {
		cwd: repoRoot,
		encoding: "utf8",
		input: options.input,
	});
	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(
			[
				`agent-browser ${args.join(" ")} failed with ${result.status}`,
				result.stdout,
				result.stderr,
			]
				.filter(Boolean)
				.join("\n"),
		);
	}
	return result.stdout.trim();
}

function evalInBrowser(source) {
	const output = runAgentBrowser(["eval", "--stdin"], { input: source });
	return JSON.parse(output);
}

function expect(name, pass, details = undefined) {
	checks.push({ name, pass, details });
	if (!pass) {
		throw new Error(
			`${name} failed${details ? `: ${JSON.stringify(details)}` : ""}`,
		);
	}
}

function expectedGroundLine(calibration) {
	const samples = [...calibration.measuredPlacements].sort((a, b) => a.x - b.x);
	const referenceHeight =
		calibration.referenceDisplayHeight ??
		samples.find((sample) => sample.displayHeight)?.displayHeight ??
		1;

	return {
		interpolation: calibration.interpolation ?? "catmull-rom",
		points: samples.map((sample) => {
			const scaleFactor =
				sample.scaleFactor ??
				(sample.displayHeight ? sample.displayHeight / referenceHeight : 1);
			return {
				x: Math.round(sample.x),
				y: Math.round(sample.y),
				scaleFactor: Number(scaleFactor.toFixed(4)),
			};
		}),
	};
}

function expectGroundLineMatchesCalibration(snapshot, reviewSceneId) {
	const calibration = placementManifests.find(
		(manifest) => manifest.reviewSceneId === reviewSceneId,
	);
	expect(
		`${reviewSceneId} has a placement calibration manifest`,
		Boolean(calibration),
		{ reviewSceneId },
	);
	const expected = expectedGroundLine(calibration);
	const actualPoints = snapshot.groundLine;
	const pass =
		actualPoints.length === expected.points.length &&
		actualPoints.every((point, index) => {
			const expectedPoint = expected.points[index];
			return (
				point.x === expectedPoint.x &&
				point.y === expectedPoint.y &&
				Math.abs((point.scaleFactor ?? 1) - expectedPoint.scaleFactor) < 0.0001
			);
		});
	expect(`${reviewSceneId} ground line matches placement calibration`, pass, {
		actual: actualPoints,
		expected: expected.points,
	});
	expect(
		`${reviewSceneId} Hermes base scale matches calibration`,
		snapshot.hermes?.baseScale === calibration.baseScale,
		{
			actual: snapshot.hermes?.baseScale,
			expected: calibration.baseScale,
		},
	);
}

function screenshot(name) {
	const path = resolve(outputDir, name);
	runAgentBrowser(["screenshot", path]);
	return path;
}

const bootstrapScript = `
(() => {
	const scene = window.game?.scene?.getScene("StoryGameScene");
	if (!scene?.getReviewQaSnapshot) return { error: "StoryGameScene QA API unavailable" };
	window.dispatchEvent(new CustomEvent("anima:review-scene", { detail: "outside" }));
	localStorage.setItem("anima.shadow-over-innsmouth.review-scene", "outside");
	scene.setPlacementDebugEnabled?.(true);
	return scene.getReviewQaSnapshot();
})()
`;

const clickAndWaitScript = (x, y, predicate, timeout = 5000) => `
(async () => {
	const canvas = document.querySelector("canvas");
	const scene = window.game?.scene?.getScene("StoryGameScene");
	if (!canvas || !scene?.getReviewQaSnapshot) {
		throw new Error("Playable scene is not ready");
	}
	const rect = canvas.getBoundingClientRect();
	const clientX = rect.left + (${x} / 1920) * rect.width;
	const clientY = rect.top + (${y} / 1080) * rect.height;
	const eventTypes = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"];
	for (const type of eventTypes) {
		const EventClass = type.startsWith("pointer") && window.PointerEvent
			? PointerEvent
			: MouseEvent;
		canvas.dispatchEvent(new EventClass(type, {
			bubbles: true,
			cancelable: true,
			clientX,
			clientY,
			pointerId: 1,
			pointerType: "mouse",
			button: 0,
			buttons: type.endsWith("down") ? 1 : 0,
		}));
	}
	const waitFor = () => new Promise((resolve, reject) => {
		const started = performance.now();
		const tick = () => {
			const snapshot = scene.getReviewQaSnapshot();
			if (${predicate}) return resolve(snapshot);
			if (performance.now() - started > ${timeout}) {
				return reject(new Error("Timed out waiting after click. Last snapshot: " + JSON.stringify(snapshot)));
			}
			requestAnimationFrame(tick);
		};
		tick();
	});
	return waitFor();
})()
`;

runAgentBrowser(["set", "viewport", "1920", "1080"]);
runAgentBrowser(["open", url]);
runAgentBrowser(["wait", "--load", "networkidle"]);

const outside = evalInBrowser(bootstrapScript);
expect("outside scene loaded", outside.reviewSceneId === "outside", outside);
expect(
	"outside uses accepted Kat composite background",
	outside.background === "bus-station-kat-seated",
	outside,
);
expect(
	"outside does not render the rejected standalone Kat sprite",
	outside.kat?.visible === false,
	outside.kat,
);
expectGroundLineMatchesCalibration(outside, "outside");
expect("Kat starts seated outside", outside.katState === "seatedIdle", outside);
expect(
	"Hermes starts on exterior ground line",
	Math.abs(outside.hermes?.y - 959) <= 16,
	outside.hermes,
);
expect(
	"Hermes starts at the reviewed exterior foreground scale",
	outside.hermes?.scale >= 0.45 && outside.hermes?.scale <= 0.47,
	outside.hermes,
);
expect(
	"Hermes starts in an authored idle animation",
	outside.hermes?.motionState === "idle" &&
		outside.hermes?.animationKey?.endsWith("-idle") &&
		outside.hermes?.textureKey === "hermes-idle-v2-normalized",
	outside.hermes,
);
expect(
	"review scene exposes the placement debug overlay",
	outside.placementDebug?.enabled === true &&
		outside.placementDebug?.labelCount >= 1,
	outside.placementDebug,
);
const outsideScreenshot = screenshot("scene-line-outside-after-fix.png");

const outsideWalk = evalInBrowser(
	clickAndWaitScript(
		520,
		760,
		'snapshot.reviewSceneId === "outside" && snapshot.hermes && snapshot.hermes.motionState === "idle" && Math.abs(snapshot.hermes.x - 520) <= 8',
		4500,
	),
);
expect(
	"free exterior click walks Hermes to the ground line",
	Math.abs(outsideWalk.hermes?.x - 520) <= 8,
	outsideWalk.hermes,
);
expect(
	"free exterior walk keeps Hermes on the authored foreground line",
	Math.abs(outsideWalk.hermes?.y - 966) <= 8,
	outsideWalk.hermes,
);
expect(
	"free exterior walk preserves the authored perspective scale",
	// landmark-derived curve: factor 0.943 at x=520, base 0.5 => 0.4715
	outsideWalk.hermes?.scale >= 0.46 && outsideWalk.hermes?.scale <= 0.48,
	outsideWalk.hermes,
);
expect(
	"Hermes returns to idle animation after a walk",
	outsideWalk.hermes?.motionState === "idle" &&
		outsideWalk.hermes?.animationKey?.endsWith("-idle") &&
		outsideWalk.hermes?.textureKey === "hermes-idle-v2-normalized",
	outsideWalk.hermes,
);
const outsideWalkScreenshot = screenshot(
	"scene-line-outside-walk-after-fix.png",
);

const outsideLeftLimit = evalInBrowser(
	clickAndWaitScript(
		20,
		760,
		'snapshot.reviewSceneId === "outside" && snapshot.hermes && snapshot.hermes.motionState === "idle" && Math.abs(snapshot.hermes.x - 200) <= 8',
		5500,
	),
);
expect(
	"free exterior walking clamps after the clipped left endpoint",
	Math.abs(outsideLeftLimit.hermes?.x - 200) <= 8,
	outsideLeftLimit.hermes,
);
expect(
	"free exterior left limit keeps Hermes fully on-screen",
	outsideLeftLimit.hermes?.bounds?.x >= 0,
	outsideLeftLimit.hermes,
);
const outsideLeftLimitScreenshot = screenshot(
	"scene-line-outside-left-limit-after-fix.png",
);

const outsideTalking = evalInBrowser(
	clickAndWaitScript(
		1040,
		560,
		'snapshot.reviewSceneId === "outside" && snapshot.katState === "seatedTalk" && snapshot.hermes && snapshot.hermes.motionState === "talk" && Math.abs(snapshot.hermes.x - 755) <= 8',
		5500,
	),
);
expect(
	"clicking the outside bench starts Kat talk pose",
	outsideTalking.katState === "seatedTalk",
	outsideTalking,
);
expect(
	"outside TALK keeps Kat baked into the accepted background",
	outsideTalking.kat?.visible === false,
	outsideTalking.kat,
);
expect(
	"Hermes walks to the outside bench approach point",
	Math.abs(outsideTalking.hermes?.x - 755) <= 8,
	outsideTalking.hermes,
);
expect(
	"Hermes approaches Kat from the reference foreground line",
	Math.abs(outsideTalking.hermes?.y - 976) <= 8,
	outsideTalking.hermes,
);
expect(
	"Hermes bench approach height matches the visual reference",
	// landmark-derived curve: factor 0.963 at x=755, base 0.5 => 0.4815
	outsideTalking.hermes?.scale >= 0.47 && outsideTalking.hermes?.scale <= 0.49,
	outsideTalking.hermes,
);
expect(
	"Hermes switches to talk animation for conversation",
	outsideTalking.hermes?.motionState === "talk" &&
		outsideTalking.hermes?.animationKey?.endsWith("-talk") &&
		outsideTalking.hermes?.textureKey === "hermes-talk-v1-normalized",
	outsideTalking.hermes,
);
const outsideBenchTalkScreenshot = screenshot(
	"scene-line-outside-bench-talk-after-fix.png",
);

const outsideKatBlocked = evalInBrowser(
	clickAndWaitScript(
		1040,
		760,
		'snapshot.reviewSceneId === "outside" && snapshot.hermes && snapshot.hermes.motionState === "idle" && Math.abs(snapshot.hermes.x - 1280) <= 8',
		5500,
	),
);
expect(
	"free exterior walking skips the blocked Kat-overlap span",
	Math.abs(outsideKatBlocked.hermes?.x - 1280) <= 8,
	outsideKatBlocked.hermes,
);
const outsideKatBlockedScreenshot = screenshot(
	"scene-line-outside-kat-blocked-after-fix.png",
);

const outsideRightLimit = evalInBrowser(
	clickAndWaitScript(
		1880,
		760,
		'snapshot.reviewSceneId === "outside" && snapshot.hermes && snapshot.hermes.motionState === "idle" && Math.abs(snapshot.hermes.x - 1520) <= 8',
		5500,
	),
);
expect(
	"free exterior walking clamps before the route-only bus/door plane",
	Math.abs(outsideRightLimit.hermes?.x - 1520) <= 8,
	outsideRightLimit.hermes,
);
expect(
	"free exterior right limit keeps Hermes at the bus-nose sample",
	Math.abs(outsideRightLimit.hermes?.y - 950) <= 8,
	outsideRightLimit.hermes,
);
expect(
	"free exterior right limit uses the reviewed scale",
	// landmark-derived curve: factor 0.913 at x=1520, base 0.5 => 0.4565
	outsideRightLimit.hermes?.scale >= 0.45 &&
		outsideRightLimit.hermes?.scale <= 0.465,
	outsideRightLimit.hermes,
);
const outsideRightLimitScreenshot = screenshot(
	"scene-line-outside-right-limit-after-fix.png",
);

const doorAtPoint = evalInBrowser(`(() => {
	const scene = window.game.scene.getScene("StoryGameScene");
	return scene.findHotspotAtPoint(1545, 500)?.id ?? null;
})()`);
expect("door hotspot covers the visible doors", doorAtPoint === "depot_doors", {
	doorAtPoint,
});

const inside = evalInBrowser(
	clickAndWaitScript(
		1545,
		500,
		'snapshot.reviewSceneId === "inside" && snapshot.hermes && snapshot.hermes.x >= 1700 && Math.abs(snapshot.lastTransition?.exitX - 1458) <= 12',
		9000,
	),
);
expect(
	"clicking the exterior door enters the depot",
	inside.reviewSceneId === "inside",
	inside,
);
expectGroundLineMatchesCalibration(inside, "inside");
expect(
	"Hermes vanishes into the house door at door scale",
	Math.abs(inside.lastTransition?.exitX - 1458) <= 12,
	inside.lastTransition,
);
expect(
	"Hermes is hidden before the interior spawn",
	inside.lastTransition?.hiddenBeforeTransition === true,
	inside.lastTransition,
);
expect(
	"Hermes spawns small/right after disappearing behind the bus",
	inside.hermes?.x >= 1700,
	inside.hermes,
);
expect(
	"Hermes spawns on interior ground line",
	inside.hermes?.y >= 910,
	inside.hermes,
);
expect(
	"Kat does not duplicate inside after being visible outside",
	inside.kat?.visible === false,
	inside.kat,
);
expect(
	"interior scene exposes waiting bench hotspot",
	inside.hotspots.some((hotspot) => hotspot.id === "waiting_bench"),
	inside.hotspots,
);
expect(
	"interior waiting bench is not a Kat TALK target after exterior Kat remains outside",
	inside.hotspots
		.find((hotspot) => hotspot.id === "waiting_bench")
		?.verbs.includes("talk") === false,
	inside.hotspots.find((hotspot) => hotspot.id === "waiting_bench"),
);
const doorTransitionScreenshot = screenshot(
	"scene-line-door-transition-after-fix.png",
);

const report = {
	url,
	generatedAt: new Date().toISOString(),
	checks,
	screenshots: {
		outside: outsideScreenshot,
		outsideWalk: outsideWalkScreenshot,
		outsideLeftLimit: outsideLeftLimitScreenshot,
		outsideBenchTalk: outsideBenchTalkScreenshot,
		outsideKatBlocked: outsideKatBlockedScreenshot,
		outsideRightLimit: outsideRightLimitScreenshot,
		doorTransition: doorTransitionScreenshot,
	},
	finalSnapshot: inside,
};

const reportPath = resolve(outputDir, "playable-scene-verification.json");
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
