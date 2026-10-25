import { type EffectCallback, useEffect, useState } from "react";

import { type DialogueState, speakerColours } from "./dialogue";
import "./styles/dialogue.css";

import { readSceneRoute, sceneUrl } from "./sceneRoute";

type ReviewSceneId = string;
type FeedbackStatus = "reviewing" | "approved" | "revise";

interface SceneFeedback {
	status: FeedbackStatus;
	notes: string;
	updatedAt?: string;
}

type OpenWorldUiState =
	| { status: "idle" }
	| { status: "loading"; object: string }
	| { status: "options"; object: string; options: [string, string, string] }
	| { status: "resolving"; object: string }
	| {
			status: "resolved";
			object: string;
			caption: string;
			imagePrompt?: string;
			imageEditMs?: number;
	  }
	| { status: "error"; message: string };

type FeedbackStore = Partial<Record<ReviewSceneId, SceneFeedback>>;

const REVIEW_SCENE_KEY = "anima.shadow-over-innsmouth.review-scene";
const FEEDBACK_KEY = "anima.shadow-over-innsmouth.scene-feedback";
const SCENES: Array<{ id: ReviewSceneId; label: string; detail: string }> = [
	{
		id: "outside",
		label: "Outside",
		detail: "Terminal exterior and bus platform",
	},
	{
		id: "inside",
		label: "Inside",
		detail: "Depot interior with Kat seated",
	},
];

const DEFAULT_FEEDBACK: FeedbackStore = {
	outside: { status: "reviewing", notes: "" },
	inside: { status: "reviewing", notes: "" },
};

export function GameUI() {
	const [sceneId, setSceneId] = useState<ReviewSceneId>(loadSceneId);
	const [feedback, setFeedback] = useState<FeedbackStore>(loadFeedback);
	const [savedMessage, setSavedMessage] = useState("");
	const [isOpen, setIsOpen] = useState(true);
	const [openWorld, setOpenWorld] = useState<OpenWorldUiState>({
		status: "idle",
	});
	const [dialogue, setDialogue] = useState<DialogueState | null>(null);
	const [freeText, setFreeText] = useState("");
	const [scenes, setScenes] = useState(SCENES);
	const [sceneError, setSceneError] = useState("");
	const [sceneLoading, setSceneLoading] = useState(true);
	const activeFeedback = feedback[sceneId] ?? {
		status: "reviewing",
		notes: "",
	};

	useMountEffect(() => {
		const controller = new AbortController();
		const api =
			import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";
		void fetch(`${api}/places`, { signal: controller.signal })
			.then((response) => {
				if (!response.ok) throw new Error("Unable to load scenes");
				return response.json();
			})
			.then(
				(
					places: Array<{
						id: string;
						description: string;
						ground?: { ground?: string; walkable?: boolean; floor?: unknown };
					}>,
				) => {
					setScenes([
						...SCENES,
						...places
							.filter(
								(place) =>
									place.ground?.floor &&
									place.ground.ground !== "failed" &&
									place.ground.walkable !== false,
							)
							.map((place) => ({
								id: place.id,
								label: place.description.split(/[.:\n]/)[0].slice(0, 95),
								detail: place.description,
							})),
					]);
				},
			)
			.catch((error: Error) => {
				if (!controller.signal.aborted) setSceneError(error.message);
			});
		const onLocation = (event: Event) => {
			setSceneId((event as CustomEvent<string>).detail);
			setSceneLoading(false);
		};
		const onSceneError = () => {
			setSceneLoading(false);
			setSceneError(
				"This scene could not load. Choose another scene or refresh to retry.",
			);
		};
		window.addEventListener("anima:location-changed", onLocation);
		window.addEventListener("anima:scene-load-error", onSceneError);
		return () => {
			controller.abort();
			window.removeEventListener("anima:location-changed", onLocation);
			window.removeEventListener("anima:scene-load-error", onSceneError);
		};
	});

	useMountEffect(() => {
		const onDialogue = (event: Event) =>
			setDialogue((event as CustomEvent<DialogueState | null>).detail);
		window.addEventListener("anima:dialogue-state", onDialogue);
		const onOpenWorldState = (event: Event) => {
			setOpenWorld((event as CustomEvent<OpenWorldUiState>).detail);
		};
		window.addEventListener("anima:open-world-state", onOpenWorldState);
		return () => {
			window.removeEventListener("anima:open-world-state", onOpenWorldState);
			window.removeEventListener("anima:dialogue-state", onDialogue);
		};
	});

	const selectScene = (nextSceneId: ReviewSceneId) => {
		setSceneLoading(true);
		window.location.assign(sceneUrl(nextSceneId));
	};

	const updateActiveFeedback = (patch: Partial<SceneFeedback>) => {
		setFeedback((current) => ({
			...current,
			[sceneId]: {
				...(current[sceneId] ?? { status: "reviewing", notes: "" }),
				...patch,
			},
		}));
		setSavedMessage("");
	};

	const saveFeedback = () => {
		const nextFeedback = {
			...feedback,
			[sceneId]: {
				...activeFeedback,
				updatedAt: new Date().toISOString(),
			},
		};
		setFeedback(nextFeedback);
		localStorage.setItem(FEEDBACK_KEY, JSON.stringify(nextFeedback));
		setSavedMessage("Saved");
	};

	const copyFeedback = async () => {
		const payload = JSON.stringify(feedback, null, 2);
		await navigator.clipboard?.writeText(payload);
		setSavedMessage("Copied");
	};

	const chooseOpenWorldAction = (choice: string) => {
		window.dispatchEvent(
			new CustomEvent("anima:open-world-choice", { detail: { choice } }),
		);
	};

	const submitFreeText = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!freeText.trim()) return;
		chooseOpenWorldAction(freeText);
	};

	return (
		<>
			<OpenWorldPrompt
				dialogue={dialogue}
				onAdvance={() =>
					window.dispatchEvent(
						new CustomEvent("anima:dialogue-advance", {
							detail: { id: dialogue?.id },
						}),
					)
				}
				onStoryChoice={(index) =>
					window.dispatchEvent(
						new CustomEvent("anima:dialogue-choice", {
							detail: { id: dialogue?.id, index },
						}),
					)
				}
				state={openWorld}
				freeText={freeText}
				onFreeTextChange={setFreeText}
				onChoose={chooseOpenWorldAction}
				onSubmitFreeText={submitFreeText}
			/>
			<aside
				className={`review-panel ${isOpen ? "is-open" : "is-collapsed"}`}
				aria-label="Scene review controls"
			>
				<div className="review-panel__header">
					<div>
						<p className="review-panel__eyebrow">Walking preview</p>
						<h1>Explore Innsmouth</h1>
					</div>
					<button
						type="button"
						className="review-panel__toggle"
						onClick={() => setIsOpen((current) => !current)}
						aria-expanded={isOpen}
					>
						{isOpen ? "Hide" : "Scenes"}
					</button>
				</div>

				<div className="review-panel__body">
					<p>Choose a scene, then click the ground to walk.</p>
					<a href="/?act=1&scene=inside">Play Act 1</a>

					<label className="review-panel__field">
						<span>Scene ({scenes.length})</span>
						<select
							aria-label="Scene"
							value={sceneId}
							disabled={sceneLoading}
							onChange={(event) => selectScene(event.currentTarget.value)}
						>
							{!scenes.some((scene) => scene.id === sceneId) ? (
								<option value={sceneId}>Loading selected scene…</option>
							) : null}
							{scenes.map((scene) => (
								<option key={scene.id} value={scene.id}>
									{scene.label}
								</option>
							))}
						</select>
					</label>
					{sceneLoading ? <output>Loading scene…</output> : null}
					{sceneError ? <p role="alert">{sceneError}</p> : null}

					<details>
						<summary>Scene feedback</summary>
						<label className="review-panel__field">
							<span>Status</span>
							<select
								value={activeFeedback.status}
								onChange={(event) =>
									updateActiveFeedback({
										status: event.currentTarget.value as FeedbackStatus,
									})
								}
							>
								<option value="reviewing">Reviewing</option>
								<option value="approved">Approved</option>
								<option value="revise">Revise</option>
							</select>
						</label>

						<label className="review-panel__field">
							<span>Feedback</span>
							<textarea
								value={activeFeedback.notes}
								onChange={(event) =>
									updateActiveFeedback({ notes: event.currentTarget.value })
								}
								placeholder="Write what should change in this scene."
							/>
						</label>

						<div className="review-panel__actions">
							<button type="button" onClick={saveFeedback}>
								Save
							</button>
							<button type="button" onClick={copyFeedback}>
								Copy JSON
							</button>
							{savedMessage ? <span>{savedMessage}</span> : null}
						</div>
					</details>
				</div>
			</aside>
		</>
	);
}

function OpenWorldPrompt({
	state,
	dialogue,
	onAdvance,
	onStoryChoice,
	freeText,
	onFreeTextChange,
	onChoose,
	onSubmitFreeText,
}: {
	state: OpenWorldUiState;
	dialogue: DialogueState | null;
	onAdvance: () => void;
	onStoryChoice: (index: number) => void;
	freeText: string;
	onFreeTextChange: (value: string) => void;
	onChoose: (choice: string) => void;
	onSubmitFreeText: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
	useEffect(() => {
		const key = (event: KeyboardEvent) => {
			if (
				!dialogue ||
				dialogue.choices.length ||
				event.repeat ||
				(event.target instanceof HTMLElement &&
					event.target.closest("input, textarea, select, button, a"))
			)
				return;
			if (event.code === "Space" || event.code === "Enter") {
				event.preventDefault();
				onAdvance();
			}
		};
		window.addEventListener("keydown", key);
		return () => window.removeEventListener("keydown", key);
	}, [dialogue, onAdvance]);
	if (!dialogue && state.status === "idle") return null;
	const speaker = dialogue?.speaker ?? "Narrator";
	const text =
		dialogue?.text ??
		(state.status === "resolved"
			? state.caption
			: state.status === "error"
				? state.message
				: state.status === "options"
					? `${state.object} — What does Hermes do?`
					: state.status === "loading"
						? state.object
						: "The salt air hangs still.");
	const choices =
		dialogue?.choices ??
		(state.status === "options"
			? state.options.map((text, index) => ({ text, index }))
			: []);
	return (
		<section
			className="dialogue-panel"
			aria-label="Dialogue"
			aria-live="polite"
		>
			<strong
				style={{ color: speakerColours[speaker] ?? speakerColours.Narrator }}
			>
				{speaker[0].toUpperCase() + speaker.slice(1)}
			</strong>
			{dialogue?.pendingArt ? (
				<small className="dialogue-panel__pending">
					[{dialogue.pendingArt}]
				</small>
			) : null}
			{dialogue && !choices.length ? (
				<button
					type="button"
					className="dialogue-panel__line"
					onClick={onAdvance}
				>
					{text}
					<span className="dialogue-panel__hint">
						{dialogue.busy ? "..." : "Click · Space · Enter"}
					</span>
				</button>
			) : (
				<p>{text}</p>
			)}
			<ol className="dialogue-panel__choices">
				{choices.map((choice) => (
					<li key={choice.index}>
						<button
							type="button"
							onClick={() =>
								dialogue ? onStoryChoice(choice.index) : onChoose(choice.text)
							}
						>
							{choice.text}
						</button>
					</li>
				))}
			</ol>
			{!dialogue && state.status === "options" ? (
				<form onSubmit={onSubmitFreeText}>
					<label htmlFor="open-world-free-text">Or write your own action</label>
					<div>
						<input
							id="open-world-free-text"
							value={freeText}
							onChange={(event) => onFreeTextChange(event.currentTarget.value)}
							autoComplete="off"
						/>
						<button type="submit" disabled={!freeText.trim()}>
							Do it
						</button>
					</div>
				</form>
			) : null}
		</section>
	);
}

// Event subscriptions are mount-only; naming the escape hatch makes that intent
// explicit and keeps feature components free of dependency-array effects.
function useMountEffect(effect: EffectCallback): void {
	useEffect(effect, []);
}

function loadSceneId(): ReviewSceneId {
	const stored = localStorage.getItem(REVIEW_SCENE_KEY);
	return readSceneRoute() ?? stored ?? "outside";
}

function loadFeedback(): FeedbackStore {
	const raw = localStorage.getItem(FEEDBACK_KEY);
	if (!raw) return DEFAULT_FEEDBACK;
	try {
		return {
			...DEFAULT_FEEDBACK,
			...(JSON.parse(raw) as Partial<FeedbackStore>),
		};
	} catch {
		return DEFAULT_FEEDBACK;
	}
}
