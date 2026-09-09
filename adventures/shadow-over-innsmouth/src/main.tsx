import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { GameUI } from "./GameUI";
import StartGame from "./game/main";
import "./styles/main.css";

declare global {
	interface Window {
		game: Phaser.Game;
	}
}

function App() {
	useMountEffect(() => {
		const gameInstance = StartGame("game-container");
		window.game = gameInstance;

		return () => {
			gameInstance.destroy(true);
		};
	});

	return <GameUI />;
}

function useMountEffect(effect: () => undefined | (() => void)) {
	useEffect(effect, []);
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
