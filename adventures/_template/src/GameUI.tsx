import {
	type EditorCallbacks,
	EditorPanel,
	type SelectedInfo,
} from "@anima/engine";
import { useCallback, useEffect, useState } from "react";

interface EditorInstance {
	copySelectedJSON: () => void;
	copyAllJSON: () => void;
	toggle: () => void;
	setCallbacks: (callbacks: EditorCallbacks) => void;
}

interface SceneWithEditor {
	getEditor?: () => EditorInstance | undefined;
}

interface GameUIProps {
	game: Phaser.Game | null;
}

export function GameUI({ game }: GameUIProps) {
	const [editorVisible, setEditorVisible] = useState(false);
	const [selected, setSelected] = useState<SelectedInfo | null>(null);

	const getEditor = useCallback((): EditorInstance | null => {
		if (!game) return null;
		const scene = game.scene.getScene("TestScene") as SceneWithEditor;
		return scene?.getEditor?.() ?? null;
	}, [game]);

	// Wire up editor callbacks when game/scene is ready
	useEffect(() => {
		if (!game) return;

		const setupEditor = () => {
			const editor = getEditor();
			if (editor) {
				editor.setCallbacks({
					onToggle: (enabled) => setEditorVisible(enabled),
					onSelect: (sel) => setSelected(sel),
				});
			}
		};

		// Scene might not be ready immediately - poll until ready
		const checkReady = setInterval(() => {
			if (getEditor()) {
				setupEditor();
				clearInterval(checkReady);
			}
		}, 100);

		// Also try immediately
		setupEditor();

		return () => {
			clearInterval(checkReady);
		};
	}, [game, getEditor]);

	const handleCopySelected = useCallback(() => {
		getEditor()?.copySelectedJSON();
	}, [getEditor]);

	const handleCopyAll = useCallback(() => {
		getEditor()?.copyAllJSON();
	}, [getEditor]);

	const handleClose = useCallback(() => {
		getEditor()?.toggle();
	}, [getEditor]);

	return (
		<EditorPanel
			visible={editorVisible}
			selected={selected}
			onCopySelected={handleCopySelected}
			onCopyAll={handleCopyAll}
			onClose={handleClose}
		/>
	);
}
