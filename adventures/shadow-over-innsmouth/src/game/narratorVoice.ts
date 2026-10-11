export function isAudioMuted(search = window.location.search): boolean {
	return (
		new URLSearchParams(search).get("mute") === "1" ||
		import.meta.env.VITE_MUTE === "1"
	);
}

export function speakCaption(caption: string, api: string, muted: boolean) {
	const controller = new AbortController();
	let current: HTMLAudioElement | undefined;
	let cancelPlayback: (() => void) | undefined;
	const status = {
		firstSentencePlayed: false,
		error: undefined as string | undefined,
	};
	const delay = (text: string) =>
		new Promise<void>((resolve) => {
			const timer = setTimeout(resolve, Math.max(2500, text.length * 60));
			controller.signal.addEventListener(
				"abort",
				() => {
					clearTimeout(timer);
					resolve();
				},
				{ once: true },
			);
		});
	const firstText = caption.match(/^[^.!?]+[.!?]?/)?.[0] ?? caption;
	const firstReading = delay(firstText);
	const fullReading = delay(caption);
	const play = async (text: string) => {
		const response = await fetch(`${api}/tts`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text }),
			signal: controller.signal,
		});
		if (!response.ok)
			throw new Error(`Narrator audio failed: ${response.status}`);
		const url = URL.createObjectURL(await response.blob());
		try {
			if (controller.signal.aborted) return;
			const audio = new Audio(url);
			current = audio;
			await new Promise<void>((resolve, reject) => {
				cancelPlayback = resolve;
				audio.onended = () => resolve();
				audio.onerror = () => reject(new Error("Audio playback failed"));
				void audio.play().catch(reject);
			});
		} finally {
			URL.revokeObjectURL(url);
		}
	};
	const failed = (error: unknown) => {
		status.error = String(error);
	};
	const first = muted
		? firstReading
		: play(firstText)
				.then(() => {
					status.firstSentencePlayed = !controller.signal.aborted;
				})
				.catch(async (error) => {
					failed(error);
					await firstReading;
				});
	const rest = caption.slice(firstText.length).trim();
	const full = muted
		? fullReading
		: first
				.then(async () => {
					if (!status.error && rest && !controller.signal.aborted)
						await play(rest);
					if (status.error) await fullReading;
				})
				.catch(async (error) => {
					failed(error);
					await fullReading;
				});
	return {
		first,
		full,
		status,
		stop: () => {
			controller.abort();
			current?.pause();
			cancelPlayback?.();
		},
	};
}
