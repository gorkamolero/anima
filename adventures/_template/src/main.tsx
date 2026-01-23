import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import StartGame from "./game/main";
import { GameUI } from "./GameUI";
import "./styles/main.css";

declare global {
	interface Window {
		game: Phaser.Game;
	}
}

function App() {
	const [game, setGame] = useState<Phaser.Game | null>(null);

	useEffect(() => {
		const gameInstance = StartGame("game-container");
		window.game = gameInstance;
		setGame(gameInstance);

		return () => {
			gameInstance.destroy(true);
		};
	}, []);

	return <GameUI game={game} />;
}

document.addEventListener("DOMContentLoaded", () => {
	const uiRoot = document.createElement("div");
	uiRoot.id = "ui-overlay";
	document.body.appendChild(uiRoot);

	createRoot(uiRoot).render(
		<StrictMode>
			<App />
		</StrictMode>,
	);
});
