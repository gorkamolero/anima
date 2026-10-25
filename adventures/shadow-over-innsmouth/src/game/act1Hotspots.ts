import type { StoryScene } from "@anima/storyscript";
import landmarks from "../../public/backgrounds/arkham-bus-depot-flat-2d.landmarks.json";
import { REVIEW_SCENES } from "./scenes/standaloneScenes";
import { storyPlace } from "./storyActs";

/** Authored depot regions are game-space landmarks, not the script's draft coordinates. */
export function act1Hotspots(scene: StoryScene, outside: boolean) {
	return scene.hotspots.flatMap((hotspot, index) => {
		let bounds = hotspot.bounds;
		if (scene.originalId === "bus_station") {
			if (outside) {
				const id =
					hotspot.id === "bench"
						? "waiting_bench"
						: hotspot.id === "exit"
							? "bus"
							: "";
				bounds = REVIEW_SCENES.outside.hotspots.find(
					(h) => h.id === id,
				)?.bounds;
			} else {
				const id = {
					bench: "bench",
					exit: "platform-doorway",
					ticket_window: "ticket-booth",
					schedule_board: "departures-board",
					vending_machine: "vending-machine",
				}[hotspot.id];
				bounds = landmarks.landmarks.find((l) => l.id === id)?.rect;
			}
		} else if (bounds) {
			// Script coordinates were authored on a 720 x 480 stage.
			bounds = {
				x: (bounds.x * 1920) / 720,
				y: (bounds.y * 1080) / 480,
				width: (bounds.width * 1920) / 720,
				height: (bounds.height * 1080) / 480,
			};
		}
		if (scene.originalId !== "bus_station") {
			if (storyPlace(scene.originalId).pendingArt || !bounds) {
				// A labelled interaction board on the placeholder stage, never pretend art.
				bounds = {
					x: 110 + (index % 3) * 560,
					y: 210 + Math.floor(index / 3) * 160,
					width: 420,
					height: 90,
				};
			} else {
				// Keep the script's spatial intent but give overlapping draft regions
				// distinct, visible click targets above the dialogue overlay.
				bounds = {
					x: Math.max(20, Math.min(1600, bounds.x + bounds.width / 2 - 110)),
					y: Math.max(150, Math.min(720, bounds.y)),
					width: 220,
					height: 55,
				};
			}
		}
		return bounds ? [{ ...hotspot, bounds }] : [];
	});
}
