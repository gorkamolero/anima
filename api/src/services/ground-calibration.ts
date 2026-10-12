import { z } from "zod";

/** A visible object, not an imagined adult or a runtime-clamped projection. */
export const scaleReferenceSchema = z.object({
	label: z.string(),
	rect: z.object({
		x: z.number().min(0).max(1),
		y: z.number().min(0).max(1),
		width: z.number().positive().max(1),
		height: z.number().positive().max(1),
	}),
	realHeightM: z.number().positive(),
});
export type ScaleReference = z.infer<typeof scaleReferenceSchema>;

export function calibrateGround(guidance: {
	horizonY: number;
	referenceFootY: number;
	referenceHeight: number;
	scaleReference?: ScaleReference;
}) {
	const reference = guidance.scaleReference;
	const footY = reference
		? reference.rect.y + reference.rect.height
		: guidance.referenceFootY;
	const height = reference
		? (reference.rect.height * 1.75) / reference.realHeightM
		: guidance.referenceHeight;
	if (footY > 1 || footY <= guidance.horizonY || !(height > 0))
		throw new Error("Invalid visible scale reference");
	const horizonY = guidance.horizonY * 1080;
	const referenceFactor = (height * 1080) / (1059 * 0.5);
	return {
		horizonY,
		referenceFactor,
		referenceFootY: footY,
		slope:
			referenceFactor /
			(reference
				? (footY - guidance.horizonY) * 1080
				: Math.max(100, (footY - guidance.horizonY) * 1080)),
	};
}

export function referenceLandmark(reference: ScaleReference) {
	return {
		id: reference.label,
		kind: "object" as const,
		rect: {
			x: reference.rect.x * 1920,
			y: reference.rect.y * 1080,
			width: reference.rect.width * 1920,
			height: reference.rect.height * 1080,
		},
		realHeightM: reference.realHeightM,
		note: "Visible object measured during derivation; independent of sprite scale and runtime clamps.",
	};
}
