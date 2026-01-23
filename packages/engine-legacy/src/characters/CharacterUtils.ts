import type { Character } from "./Character";

/**
 * Multiplier for calculating character head position from sprite height.
 * 0.9 means head is at 90% up from the feet (origin at bottom-center).
 */
const HEAD_POSITION_MULTIPLIER = 0.9;

/**
 * Get character head position for transitions/effects.
 * Returns center of camera viewport if no character provided.
 */
export function getCharacterHeadPosition(
  character: Character | undefined,
  fallbackCamera: Phaser.Cameras.Scene2D.Camera
): { x: number; y: number } {
  if (!character) {
    return {
      x: fallbackCamera.scrollX + fallbackCamera.width / 2,
      y: fallbackCamera.scrollY + fallbackCamera.height / 2,
    };
  }
  const headOffset = character.displayHeight * HEAD_POSITION_MULTIPLIER;
  return { x: character.x, y: character.y - headOffset };
}
