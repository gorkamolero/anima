import { AUTO, Game } from "phaser";
import { StoryGameScene } from "./scenes/StoryGameScene";

const config: Phaser.Types.Core.GameConfig = {
	type: AUTO,
	width: 1920,
	height: 1080,
	parent: "game-container",
	backgroundColor: "#1a1a1a",
	scale: {
		mode: Phaser.Scale.FIT,
		autoCenter: Phaser.Scale.CENTER_BOTH,
	},
	scene: [StoryGameScene],
	physics: {
		default: "arcade",
		arcade: {
			gravity: { x: 0, y: 0 },
			debug: false,
		},
	},
};

const StartGame = (parent: string) => {
	const game = new Game({ ...config, parent });

	// Handle resize
	const handleResize = () => {
		game.scale.setParentSize(window.innerWidth, window.innerHeight);
		game.scale.refresh();
	};
	handleResize();
	window.addEventListener("resize", handleResize);

	return game;
};

export default StartGame;
