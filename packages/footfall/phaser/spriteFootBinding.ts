import type { GameObjects } from "phaser";
import type { FootCycle, FootPose } from "../core/characters/footLock";

/** Phaser sprite/metadata glue; the game supplies its directional asset mapping. */
export function spriteFootBinding(
	spriteFor: () => GameObjects.Sprite | undefined,
	metadata: (texture: string) => FootCycle,
	unavailable = "Character unavailable",
) {
	const cycle = (texture: string) => {
		const data = metadata(texture);
		if (!data?.contacts) throw new Error(`Missing sole contacts: ${texture}`);
		return { ...data, name: texture };
	};
	const show = (pose: FootPose) => {
		const sprite = spriteFor();
		if (!sprite) return;
		sprite.anims.stop();
		sprite
			.setTexture(pose.cycle.name, pose.frame)
			.setOrigin(0.5, 1)
			.setFlipX(pose.flipX);
	};
	const current = () => {
		const sprite = spriteFor();
		if (!sprite) throw new Error(unavailable);
		return {
			cycle: cycle(sprite.texture.key),
			frame: Number(sprite.frame.name),
			flipX: sprite.flipX,
		};
	};
	return { cycle, current, show };
}
