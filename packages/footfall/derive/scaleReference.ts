import type { ScaleReference } from "./types";

type Rect = ScaleReference["rect"];
export interface ReferenceInstance {
	/** Pieces belonging to one segmented instance must share this identifier. */
	id: string;
	label: string;
	/** Normalized image coordinates, like the reference rectangle. */
	rect: Rect;
}

const category = (label: string) =>
	label.toLowerCase().trim().replace(/-\d+$/, "").replace(/s$/, "");
const intersection = (a: Rect, b: Rect) =>
	Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
	Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

/** Missing segmentation cannot invalidate a reference. Contradiction requires
 * overlapping instances of the same category, none matching the reference box.
 * This checks the pictured object, not the accuracy of its assumed real height. */
export function assessScaleReference(
	reference: ScaleReference,
	instances: readonly ReferenceInstance[],
): { status: "supported" | "contradicted" | "unknown"; bestIoU: number } {
	const grouped = new Map<string, Rect>();
	for (const instance of instances) {
		if (category(instance.label) !== category(reference.label)) continue;
		const rect = instance.rect;
		if (!(rect.width > 0 && rect.height > 0)) continue;
		const old = grouped.get(instance.id);
		if (!old) grouped.set(instance.id, { ...rect });
		else {
			const x = Math.min(old.x, rect.x),
				y = Math.min(old.y, rect.y);
			grouped.set(instance.id, {
				x,
				y,
				width: Math.max(old.x + old.width, rect.x + rect.width) - x,
				height: Math.max(old.y + old.height, rect.y + rect.height) - y,
			});
		}
	}
	const area = reference.rect.width * reference.rect.height;
	let bestIoU = 0,
		overlapping = false;
	for (const rect of grouped.values()) {
		const shared = intersection(reference.rect, rect);
		overlapping ||= shared >= area * 0.1;
		bestIoU = Math.max(
			bestIoU,
			shared / (area + rect.width * rect.height - shared),
		);
	}
	return {
		status:
			bestIoU >= 0.5 ? "supported" : overlapping ? "contradicted" : "unknown",
		bestIoU,
	};
}
