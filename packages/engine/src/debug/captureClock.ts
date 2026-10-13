/** The shared fake-clock subdivision used by browser capture and Node QA. */
export function captureSteps(ms: number): number[] {
	const count = Math.max(1, Math.ceil(ms / (1000 / 60)));
	return Array(count).fill(ms / count) as number[];
}
