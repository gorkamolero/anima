import { type EffectCallback, useEffect, useState } from "react";

type ReviewSceneId = "outside" | "inside";
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

type FeedbackStore = Record<ReviewSceneId, SceneFeedback>;

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
	const [isOpen, setIsOpen] = useState(false);
	const [openWorld, setOpenWorld] = useState<OpenWorldUiState>({
		status: "idle",
	});
	const [freeText, setFreeText] = useState("");
	const activeFeedback = feedback[sceneId];

	useMountEffect(() => {
		const onOpenWorldState = (event: Event) => {
			setOpenWorld((event as CustomEvent<OpenWorldUiState>).detail);
		};
		window.addEventListener("anima:open-world-state", onOpenWorldState);
		return () => {
			window.removeEventListener("anima:open-world-state", onOpenWorldState);
		};
	});

	const selectScene = (nextSceneId: ReviewSceneId) => {
		setSceneId(nextSceneId);
		localStorage.setItem(REVIEW_SCENE_KEY, nextSceneId);
		window.dispatchEvent(
			new CustomEvent("anima:review-scene", { detail: nextSceneId }),
		);
	};

	const updateActiveFeedback = (patch: Partial<SceneFeedback>) => {
		setFeedback((current) => ({
			...current,
			[sceneId]: {
				...current[sceneId],
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
						<p className="review-panel__eyebrow">Scene Review</p>
						<h1>Starting Scenes</h1>
					</div>
					<button
						type="button"
						className="review-panel__toggle"
						onClick={() => setIsOpen((current) => !current)}
						aria-expanded={isOpen}
					>
						{isOpen ? "Hide" : "Review"}
					</button>
				</div>

				<div className="review-panel__body">
					<span className="review-panel__status">{activeFeedback.status}</span>

					<div
						className="review-panel__tabs"
						role="tablist"
						aria-label="Scenes"
					>
						{SCENES.map((scene) => (
							<button
								type="button"
								key={scene.id}
								className={scene.id === sceneId ? "is-active" : ""}
								onClick={() => selectScene(scene.id)}
							>
								<span>{scene.label}</span>
								<small>{scene.detail}</small>
							</button>
						))}
					</div>

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
				</div>
			</aside>
		</>
	);
}

function OpenWorldPrompt({
	state,
	freeText,
	onFreeTextChange,
	onChoose,
	onSubmitFreeText,
}: {
	state: OpenWorldUiState;
	freeText: string;
	onFreeTextChange: (value: string) => void;
	onChoose: (choice: string) => void;
	onSubmitFreeText: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
	if (state.status === "idle") return null;

	return (
		<section
			className={`open-world-prompt open-world-prompt--${state.status}`}
			aria-live="polite"
			aria-label="Narrator choices"
		>
			{state.status === "loading" || state.status === "resolving" ? (
				<p className="open-world-prompt__waiting">
					{state.status === "loading"
						? `Considering ${state.object}…`
						: `Resolving your choice for ${state.object}…`}
				</p>
			) : null}

			{state.status === "options" ? (
				<>
					<p className="open-world-prompt__eyebrow">{state.object}</p>
					<h2>What does Hermes do?</h2>
					<div className="open-world-prompt__options">
						{state.options.map((option) => (
							<button
								type="button"
								key={option}
								onClick={() => onChoose(option)}
							>
								{option}
							</button>
						))}
					</div>
					<form
						className="open-world-prompt__free-text"
						onSubmit={onSubmitFreeText}
					>
						<label htmlFor="open-world-free-text">
							Or write your own action
						</label>
						<div>
							<input
								id="open-world-free-text"
								value={freeText}
								onChange={(event) =>
									onFreeTextChange(event.currentTarget.value)
								}
								placeholder="I…"
								autoComplete="off"
							/>
							<button type="submit" disabled={!freeText.trim()}>
								Do it
							</button>
						</div>
					</form>
				</>
			) : null}

			{state.status === "resolved" ? (
				<>
					<p className="open-world-prompt__eyebrow">{state.object}</p>
					<p className="open-world-prompt__caption">{state.caption}</p>
				</>
			) : null}

			{state.status === "error" ? (
				<p className="open-world-prompt__error">{state.message}</p>
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
	return stored === "inside" || stored === "outside" ? stored : "outside";
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
