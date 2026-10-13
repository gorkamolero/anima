import type { GameObjects, Scene } from "phaser";
import type { Occluder } from "../core/occlusion/occlusion";
import { cellPoint } from "../core/walkarea/navigation";
import { scaleAt } from "../core/walkarea/perspective";
import type { WalkArea } from "../core/walkarea/types";
export interface ObjectLayer {
	data: Occluder;
	alpha(x: number, y: number): boolean;
	image: GameObjects.Image;
}
export async function loadOccluderImages(occluders: Occluder[], base: string) {
	return Promise.all(
		occluders.map(async (object) => {
			const url = new URL(object.png, base).href;
			const img = new Image();
			img.crossOrigin = "anonymous";
			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve();
				img.onerror = () =>
					reject(new Error(`Occluder image failed: ${object.id}`));
				img.src = url;
			});
			const canvas = document.createElement("canvas");
			canvas.width = img.width;
			canvas.height = img.height;
			const context = canvas.getContext("2d");
			if (!context) throw new Error("No mask context");
			context.drawImage(img, 0, 0);
			const pixels = context.getImageData(0, 0, img.width, img.height).data;
			const alpha = (x: number, y: number) => {
				const cx = Math.floor(
						((x - object.bbox.x) * img.width) / object.bbox.w,
					),
					cy = Math.floor(((y - object.bbox.y) * img.height) / object.bbox.h);
				return (
					cx >= 0 &&
					cy >= 0 &&
					cx < img.width &&
					cy < img.height &&
					pixels[(cy * img.width + cx) * 4 + 3] > 127
				);
			};
			return { object, url, img, alpha };
		}),
	);
}
export function createOccluderLayers(
	scene: Scene,
	layerArea: WalkArea | undefined,
	loaded: Awaited<ReturnType<typeof loadOccluderImages>>,
): ObjectLayer[] {
	const layers: ObjectLayer[] = [];
	for (const { object, url, img, alpha } of loaded) {
		const canOverlap =
			!layerArea ||
			layerArea.mask.data.some((v, i) => {
				if (!v) return false;
				const p = cellPoint(layerArea.mask, i);
				const scale =
					layerArea.baseScale *
					scaleAt(layerArea.perspective, p, layerArea.scaleClamp);
				return (
					p.y >= object.bbox.y &&
					p.y - 1059 * scale <= object.bbox.y + object.bbox.h &&
					p.x + 306 * scale >= object.bbox.x &&
					p.x - 306 * scale <= object.bbox.x + object.bbox.w
				);
			});
		if (!scene.textures.exists(url)) scene.textures.addImage(url, img);
		layers.push({
			data: object,
			alpha,
			image: scene.add
				.image(object.bbox.x, object.bbox.y, url)
				.setOrigin(0)
				.setDisplaySize(object.bbox.w, object.bbox.h)
				.setVisible(canOverlap),
		});
	}
	return layers;
}
