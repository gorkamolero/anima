/**
 * Art landmarks: backgrounds describe their own geometry so scene data
 * (scale curves, hotspot bounds, character sizes) can be DERIVED and
 * VERIFIED instead of hand-tuned against pixels.
 *
 * A background ships with `<image>.landmarks.json` next to it. When the
 * art regenerates, the landmarks regenerate with it, and every number in
 * scene data that disagrees gets reported — with the value to use instead.
 *
 * Pure TypeScript, no Phaser imports: usable from Node, tests, and the
 * browser (window.__anima.verifyArt wires it to a live scene).
 */

export interface LandmarkRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface Landmark {
	id: string;
	/**
	 * figure: a person (uses standingFactor for seated poses)
	 * object: anything with a known real-world height
	 * region: an interactive area a hotspot should cover (no height)
	 */
	kind: "figure" | "object" | "region";
	/** Game-space rect. Bottom edge = ground contact. */
	rect: LandmarkRect;
	/** Real-world height in meters (figure/object). */
	realHeightM?: number;
	/** For seated/crouched figures: painted height / standing height (e.g. 0.78). */
	standingFactor?: number;
	/** Set false to exclude from the perspective model (still reported). */
	use?: boolean;
	/** For region landmarks: the hotspot id whose bounds should cover this. */
	hotspotId?: string;
	note?: string;
}

export interface LandmarksFile {
	image: string;
	/** Coordinate space of all rects. Only "game" (1920x1080) is supported. */
	space: "game";
	/** Y of the horizon / vanishing line, where object size approaches 0. */
	horizonY?: number;
	/**
	 * Accepted creative deviation: multiply model expectations by this.
	 * Records "the reviewed character presentation is N% of what strict
	 * perspective from the painted figures implies" — explicit, not hidden.
	 */
	figureCalibration?: number;
	landmarks: Landmark[];
}

export interface PerspectiveSample {
	id: string;
	groundY: number;
	/** Pixels per meter implied by this landmark at its ground contact. */
	ppm: number;
	used: boolean;
	note?: string;
}

export interface PerspectiveModel {
	samples: PerspectiveSample[];
	/** Expected pixels-per-meter at a ground-contact y (calibration applied). */
	ppmAt(y: number): number;
	/** True when the model has enough data to make scale claims. */
	usable: boolean;
}

export interface ArtViolation {
	severity: "error" | "warning";
	type:
		| "art-internally-inconsistent"
		| "character-scale"
		| "groundline-scale"
		| "hotspot-bounds"
		| "missing-landmarks";
	subject: string;
	actual: unknown;
	expected: unknown;
	/** The concrete value to use instead. */
	suggestion: unknown;
	note?: string;
}

export interface ArtReport {
	image: string;
	pass: boolean;
	violations: ArtViolation[];
	model: { samples: PerspectiveSample[]; usable: boolean };
}

/** Standing-equivalent pixel height of a landmark. */
function landmarkPixelHeight(landmark: Landmark): number {
	return landmark.rect.height / (landmark.standingFactor ?? 1);
}

function landmarkGroundY(landmark: Landmark): number {
	return landmark.rect.y + landmark.rect.height;
}

/**
 * Build a perspective model from a landmarks file.
 * Size scales linearly with distance below the horizon, so we fit
 * ppm(y) = a*y + b through the landmark samples, with the horizon (ppm = 0)
 * as an extra sample when declared. Falls back to constant ppm when the
 * samples span too little vertical range for a stable fit.
 */
export function buildPerspectiveModel(file: LandmarksFile): PerspectiveModel {
	const calibration = file.figureCalibration ?? 1;
	const samples: PerspectiveSample[] = file.landmarks
		.filter((landmark) => landmark.kind !== "region" && landmark.realHeightM)
		.map((landmark) => ({
			id: landmark.id,
			groundY: landmarkGroundY(landmark),
			ppm: landmarkPixelHeight(landmark) / (landmark.realHeightM as number),
			used: landmark.use !== false,
			note: landmark.note,
		}));

	const points = samples
		.filter((sample) => sample.used)
		.map((sample) => ({ x: sample.groundY, y: sample.ppm }));
	if (file.horizonY !== undefined) points.push({ x: file.horizonY, y: 0 });

	if (points.length === 0) {
		return { samples, usable: false, ppmAt: () => 0 };
	}

	const ySpread =
		Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x));
	if (points.length === 1 || ySpread < 100) {
		// ponytail: constant ppm when depth range is too small for a line fit
		const mean = points.reduce((sum, p) => sum + p.y, 0) / points.length || 0;
		return {
			samples,
			usable: mean > 0,
			ppmAt: () => mean * calibration,
		};
	}

	// Least-squares line ppm = a*y + b
	const n = points.length;
	const sumX = points.reduce((s, p) => s + p.x, 0);
	const sumY = points.reduce((s, p) => s + p.y, 0);
	const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
	const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
	const a = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
	const b = (sumY - a * sumX) / n;

	return {
		samples,
		usable: true,
		ppmAt: (y: number) => Math.max(0, (a * y + b) * calibration),
	};
}

/**
 * Check the used landmarks against the fitted model: a landmark whose
 * implied size deviates badly means the ART is internally inconsistent
 * (elements painted at incompatible scales) — no data fix can satisfy it.
 */
export function checkArtConsistency(
	file: LandmarksFile,
	model: PerspectiveModel,
	tolerance = 0.2,
): ArtViolation[] {
	if (!model.usable) return [];
	const calibration = file.figureCalibration ?? 1;
	const violations: ArtViolation[] = [];
	for (const sample of model.samples) {
		const expected = model.ppmAt(sample.groundY) / calibration;
		if (expected <= 0) continue;
		const deviation = Math.abs(sample.ppm - expected) / expected;
		if (deviation > tolerance) {
			violations.push({
				severity: sample.used ? "error" : "warning",
				type: "art-internally-inconsistent",
				subject: sample.id,
				actual: `${Math.round(sample.ppm)} px/m at y=${Math.round(sample.groundY)}`,
				expected: `${Math.round(expected)} px/m`,
				suggestion: sample.used
					? "repaint/rescale this element or set use:false with a note"
					: "already excluded from the model (use:false)",
				note: sample.note,
			});
		}
	}
	return violations;
}

export interface CharacterMeasurement {
	id: string;
	x: number;
	y: number;
	visible: boolean;
	displayHeight: number;
	/** Current rendered scale (base scale x groundline factor). */
	scale: number;
	/** Base scale before groundline perspective adjustment. */
	baseScale?: number;
}

/**
 * Verify rendered character sizes against the model.
 * Suggestion is the display scale that would make the character correct.
 */
export function checkCharacterScales(
	characters: CharacterMeasurement[],
	model: PerspectiveModel,
	options: {
		characterHeightsM?: Record<string, number>;
		defaultHeightM?: number;
		tolerance?: number;
	} = {},
): ArtViolation[] {
	if (!model.usable) return [];
	const tolerance = options.tolerance ?? 0.15;
	const defaultHeight = options.defaultHeightM ?? 1.75;
	const violations: ArtViolation[] = [];

	for (const character of characters) {
		if (!character.visible || character.displayHeight <= 0) continue;
		const heightM = options.characterHeightsM?.[character.id] ?? defaultHeight;
		const expectedPx = model.ppmAt(character.y) * heightM;
		if (expectedPx <= 0) continue;
		const deviation =
			Math.abs(character.displayHeight - expectedPx) / expectedPx;
		if (deviation > tolerance) {
			const contentHeight = character.displayHeight / character.scale;
			violations.push({
				severity: "error",
				type: "character-scale",
				subject: character.id,
				actual: `${Math.round(character.displayHeight)}px at y=${Math.round(character.y)}`,
				expected: `${Math.round(expectedPx)}px (${heightM}m)`,
				suggestion: {
					scale: Number((expectedPx / contentHeight).toFixed(4)),
				},
			});
		}
	}
	return violations;
}

export interface GroundLineMeasurement {
	x: number;
	y: number;
	scaleFactor?: number;
}

/**
 * Verify a groundline's scaleFactor curve against the model, using a
 * reference character's base scale and sprite content height to convert
 * expected pixel heights into scale factors.
 */
export function checkGroundLineScales(
	points: GroundLineMeasurement[],
	model: PerspectiveModel,
	reference: {
		baseScale: number;
		contentHeight: number;
		heightM?: number;
	},
	tolerance = 0.15,
): ArtViolation[] {
	if (!model.usable) return [];
	const heightM = reference.heightM ?? 1.75;
	const violations: ArtViolation[] = [];

	for (const point of points) {
		const expectedPx = model.ppmAt(point.y) * heightM;
		if (expectedPx <= 0) continue;
		const expectedFactor =
			expectedPx / (reference.baseScale * reference.contentHeight);
		const actualFactor = point.scaleFactor ?? 1;
		const deviation = Math.abs(actualFactor - expectedFactor) / expectedFactor;
		if (deviation > tolerance) {
			violations.push({
				severity: "error",
				type: "groundline-scale",
				subject: `groundline point (${point.x}, ${point.y})`,
				actual: actualFactor,
				expected: Number(expectedFactor.toFixed(3)),
				suggestion: { scaleFactor: Number(expectedFactor.toFixed(3)) },
			});
		}
	}
	return violations;
}

export interface HotspotMeasurement {
	id: string;
	bounds: LandmarkRect;
}

function overlapRatio(a: LandmarkRect, b: LandmarkRect): number {
	const ix = Math.max(
		0,
		Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
	);
	const iy = Math.max(
		0,
		Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
	);
	const intersection = ix * iy;
	const union = a.width * a.height + b.width * b.height - intersection;
	return union > 0 ? intersection / union : 0;
}

/**
 * Verify hotspot bounds cover their declared art regions.
 * Suggestion is the landmark rect itself.
 */
export function checkHotspotBounds(
	hotspots: HotspotMeasurement[],
	file: LandmarksFile,
	minOverlap = 0.4,
): ArtViolation[] {
	const violations: ArtViolation[] = [];
	for (const landmark of file.landmarks) {
		if (landmark.kind !== "region" || !landmark.hotspotId) continue;
		const hotspot = hotspots.find((item) => item.id === landmark.hotspotId);
		if (!hotspot) {
			violations.push({
				severity: "warning",
				type: "hotspot-bounds",
				subject: landmark.hotspotId,
				actual: "hotspot not present in scene",
				expected: landmark.rect,
				suggestion: landmark.rect,
				note: landmark.note,
			});
			continue;
		}
		const ratio = overlapRatio(hotspot.bounds, landmark.rect);
		if (ratio < minOverlap) {
			violations.push({
				severity: "error",
				type: "hotspot-bounds",
				subject: landmark.hotspotId,
				actual: hotspot.bounds,
				expected: `>= ${minOverlap} overlap with art region`,
				suggestion: landmark.rect,
				note: `overlap ${ratio.toFixed(2)}${landmark.note ? ` — ${landmark.note}` : ""}`,
			});
		}
	}
	return violations;
}

/**
 * Full verification of a live scene against a landmarks file.
 * The single entry point agents call (via window.__anima.verifyArt).
 */
export function verifySceneArt(
	scene: {
		characters: CharacterMeasurement[];
		hotspots: HotspotMeasurement[];
		groundLine: GroundLineMeasurement[];
	},
	file: LandmarksFile,
	options: {
		characterHeightsM?: Record<string, number>;
		defaultHeightM?: number;
		tolerance?: number;
		referenceCharacterId?: string;
	} = {},
): ArtReport {
	const model = buildPerspectiveModel(file);
	const violations: ArtViolation[] = [
		...checkArtConsistency(file, model),
		...checkCharacterScales(scene.characters, model, options),
		...checkHotspotBounds(scene.hotspots, file),
	];

	const reference =
		scene.characters.find(
			(character) => character.id === options.referenceCharacterId,
		) ?? scene.characters.find((character) => character.visible);
	if (reference && reference.scale > 0) {
		violations.push(
			...checkGroundLineScales(scene.groundLine, model, {
				baseScale: reference.baseScale ?? reference.scale,
				contentHeight: reference.displayHeight / reference.scale,
				heightM:
					options.characterHeightsM?.[reference.id] ??
					options.defaultHeightM ??
					1.75,
			}),
		);
	}

	if (!model.usable) {
		violations.push({
			severity: "warning",
			type: "missing-landmarks",
			subject: file.image,
			actual: "no usable figure/object landmarks",
			expected: "at least one landmark with realHeightM (plus horizonY)",
			suggestion:
				"annotate known-height objects in the landmarks file to enable scale verification",
		});
	}

	return {
		image: file.image,
		pass: violations.every((violation) => violation.severity !== "error"),
		violations,
		model: { samples: model.samples, usable: model.usable },
	};
}
