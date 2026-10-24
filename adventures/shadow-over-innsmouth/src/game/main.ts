import { AUTO, Game } from "phaser";
import { isAudioMuted } from "./narratorVoice";
import { StoryGameScene } from "./scenes/StoryGameScene";
import { WalkLabScene } from "./scenes/WalkLabScene";

const config: Phaser.Types.Core.GameConfig = {
	type: AUTO,
	audio: { noAudio: isAudioMuted() },
	width: 1920,
	height: 1080,
	parent: "game-container",
	backgroundColor: "#1a1a1a",
	scale: {
		mode: Phaser.Scale.FIT,
		autoCenter: Phaser.Scale.CENTER_BOTH,
	},
	// `?lab=1` opens the walk lab: a black field and one line, for judging motion.
	scene: new URLSearchParams(window.location.search).has("lab")
		? [WalkLabScene]
		: [StoryGameScene],
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
		// React StrictMode double-mounts leave a destroyed first instance behind.
		if (!game.isRunning || !game.scale?.parentSize) return;
		game.scale.setParentSize(window.innerWidth, window.innerHeight);
		game.scale.refresh();
	};
	handleResize();
	window.addEventListener("resize", handleResize);

	return game;
};

export default StartGame;
