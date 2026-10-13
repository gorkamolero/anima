/** Allocate a cycle's time across support phases. No source pose is held longer
 * than an output frame; short supports donate their unused duration to longer
 * supports. Partial entries use the same clock as their complete support. */
export function stanceFrameMs(
	lengths: number[],
	count: number,
	requestedCadence: number,
): number {
	const frames = lengths.reduce((n, length) => n + length, 0);
	const cadence = Math.max(requestedCadence, (24 * lengths.length) / frames);
	const seconds = lengths.length / cadence;
	let low = 0,
		high = Math.max(...lengths) / 24;
	for (let i = 0; i < 40; i++) {
		const middle = (low + high) / 2;
		const total = lengths.reduce(
			(n, length) => n + Math.min(length / 24, middle),
			0,
		);
		if (total < seconds) low = middle;
		else high = middle;
	}
	return (1000 * Math.min(count / 24, (low + high) / 2)) / count;
}
