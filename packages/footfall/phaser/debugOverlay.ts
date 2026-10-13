import type { GameObjects } from "phaser";
import type { GroundLinePoint } from "../core/groundline/types";
import type { Exit } from "../core/occlusion/exits";
import type { Occluder } from "../core/occlusion/occlusion";

export interface PlacementDebugHost {
	placementDebugGraphics?: GameObjects.Graphics;
	placementDebugEnabled: boolean;
	reviewSceneId?: string;
	activeScene(): { groundLine: { points: GroundLinePoint[] } };
	clearPlacementDebugLabels(): void;
	addPlacementDebugLabel(
		x: number,
		y: number,
		text: string,
		color: string,
	): void;
	sceneExits: Exit[];
	objectLayers: { data: Occluder }[];
	hermesSprite?: GameObjects.Sprite & { getBaseScale(): number };
	hermesMotionState: string;
	scale: { width: number };
}
/** Render the existing placement overlay with the host's label lifecycle. */
export function refreshPlacementDebugOverlay(
	host: PlacementDebugHost,
	titleBarHeight: number,
): void {
	const graphics = host.placementDebugGraphics;
	if (!graphics) return;
	graphics.clear();
	host.clearPlacementDebugLabels();
	if (!host.placementDebugEnabled || !host.reviewSceneId) return;

	const scene = host.activeScene();
	const points = scene.groundLine.points;
	graphics.lineStyle(2, 0xff66dd, 0.9);
	for (const exit of host.sceneExits) {
		graphics.strokePoints(exit.region, true);
		if (exit.region[0])
			host.addPlacementDebugLabel(
				exit.region[0].x,
				exit.region[0].y,
				exit.id,
				"#ff66dd",
			);
	}
	for (const layer of host.objectLayers)
		graphics.strokePoints(layer.data.baseline, false);
	if (points.length > 1) {
		graphics.lineStyle(3, 0x4de8ff, 0.88);
		graphics.beginPath();
		graphics.moveTo(points[0].x, points[0].y);
		for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
		graphics.strokePath();
	}

	for (const point of points) {
		graphics.fillStyle(0xffd166, 0.94);
		graphics.fillCircle(point.x, point.y, 7);
		graphics.lineStyle(2, 0x111111, 0.82);
		graphics.strokeCircle(point.x, point.y, 7);
		host.addPlacementDebugLabel(
			point.x + 10,
			point.y - 28,
			`${point.x},${point.y} x${(point.scaleFactor ?? 1).toFixed(3)}`,
			"#ffe7a3",
		);
	}

	const hermes = host.hermesSprite;
	if (hermes?.visible) {
		const bounds = hermes.getBounds();
		graphics.lineStyle(2, 0x7cff80, 0.92);
		graphics.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
		graphics.lineStyle(2, 0xff4d6d, 0.92);
		graphics.lineBetween(hermes.x - 22, hermes.y, hermes.x + 22, hermes.y);
		graphics.lineBetween(hermes.x, hermes.y - 22, hermes.x, hermes.y + 22);
		host.addPlacementDebugLabel(
			Math.min(hermes.x + 18, host.scale.width - 280),
			Math.max(bounds.y + 8, titleBarHeight + 8),
			[
				`Hermes ${Math.round(hermes.x)},${Math.round(hermes.y)}`,
				`scale ${hermes.scaleX.toFixed(4)} base ${hermes.getBaseScale().toFixed(3)}`,
				`h ${Math.round(hermes.displayHeight)} ${host.hermesMotionState}`,
				`anim ${hermes.anims.currentAnim?.key ?? "none"}`,
			].join("\n"),
			"#b9ffbf",
		);
	}
}
