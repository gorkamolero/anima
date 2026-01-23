import type { GroundLineConfig, GroundLinePoint } from "./types";

/**
 * Ground line data structure with interpolation.
 * Handles Y position lookup and perspective scaling.
 */
export class GroundLine {
	private points: GroundLinePoint[];
	private perspectiveConfig: GroundLineConfig["perspectiveScale"];

	constructor(config: GroundLineConfig) {
		// Sort points by X for proper interpolation
		this.points = [...config.points].sort((a, b) => a.x - b.x);
		this.perspectiveConfig = config.perspectiveScale;
	}

	/**
	 * Get Y position for a given X coordinate.
	 * Interpolates linearly between points.
	 */
	getYAtX(x: number): number {
		if (this.points.length === 0) return 0;
		if (this.points.length === 1) return this.points[0].y;

		// Clamp to bounds
		if (x <= this.points[0].x) return this.points[0].y;
		if (x >= this.points[this.points.length - 1].x) {
			return this.points[this.points.length - 1].y;
		}

		// Find surrounding points and interpolate
		for (let i = 0; i < this.points.length - 1; i++) {
			const left = this.points[i];
			const right = this.points[i + 1];

			if (x >= left.x && x <= right.x) {
				const t = (x - left.x) / (right.x - left.x);
				return left.y + t * (right.y - left.y);
			}
		}

		return this.points[0].y;
	}

	/**
	 * Get perspective scale for a given Y position.
	 * Characters at foregroundY get scale 1.0, at backgroundY get minScale.
	 */
	getScaleAtY(y: number, baseScale: number): number {
		if (!this.perspectiveConfig) return baseScale;

		const { foregroundY, backgroundY, minScale } = this.perspectiveConfig;

		// Avoid division by zero
		const range = foregroundY - backgroundY;
		if (range === 0) return baseScale;

		// Normalize: 0 = background (far), 1 = foreground (near)
		const t = Math.max(0, Math.min(1, (y - backgroundY) / range));

		// Interpolate scale: background = minScale, foreground = 1.0
		const scaleFactor = minScale + t * (1 - minScale);
		return baseScale * scaleFactor;
	}

	/**
	 * Get both Y and scale for a given X position
	 */
	getPositionData(x: number, baseScale: number): { y: number; scale: number } {
		const y = this.getYAtX(x);
		const scale = this.getScaleAtY(y, baseScale);
		return { y, scale };
	}

	// Accessors
	getPoints(): readonly GroundLinePoint[] {
		return this.points;
	}

	getMinX(): number {
		return this.points.length > 0 ? this.points[0].x : 0;
	}

	getMaxX(): number {
		return this.points.length > 0 ? this.points[this.points.length - 1].x : 0;
	}

	// Mutation methods (return new instance for immutability)
	addPoint(point: GroundLinePoint): GroundLine {
		const newPoints = [...this.points, point].sort((a, b) => a.x - b.x);
		return new GroundLine({
			points: newPoints,
			perspectiveScale: this.perspectiveConfig,
		});
	}

	updatePoint(index: number, point: GroundLinePoint): GroundLine {
		const newPoints = [...this.points];
		newPoints[index] = point;
		return new GroundLine({
			points: newPoints.sort((a, b) => a.x - b.x),
			perspectiveScale: this.perspectiveConfig,
		});
	}

	removePoint(index: number): GroundLine {
		if (this.points.length <= 2) {
			// Don't allow removing if only 2 points left
			return this;
		}
		const newPoints = this.points.filter((_, i) => i !== index);
		return new GroundLine({
			points: newPoints,
			perspectiveScale: this.perspectiveConfig,
		});
	}
}
