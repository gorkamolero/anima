/** Stance-phase QA using independently registered sprite foot displacement.
 * Repeated animation frames keep their phase; all pairs contribute in full 2D.
 * rootMotion is deliberately not read by this metric.
 */
export function measureWalk(log, sheets) {
	const phases = [];
	let phase;
	for (let i = 1; i < log.length; i++) {
		const a = log[i - 1],
			b = log[i];
		const sheet = sheets[b.texture];
		if (
			!sheet ||
			!a.walking ||
			!b.walking ||
			a.texture !== b.texture ||
			a.flip !== b.flip
		) {
			phase = undefined;
			continue;
		}
		if (a.frame === b.frame) continue;
		if ((a.frame + 1) % sheet.frameCount !== b.frame) {
			throw new Error(`Skipped animation frame at capture ${i}`);
		}
		const r = sheet.footRegistration[b.frame].chosen;
		if (!phase || phase.foot !== r.foot) {
			phase = {
				foot: r.foot,
				first: i,
				last: i,
				bodyTravel: 0,
				drift: 0,
				dx: 0,
				dy: 0,
				maxDrift: 0,
				pairs: 0,
			};
			phases.push(phase);
		}
		const sign = b.flip ? -1 : 1;
		const dx =
			b.x -
			a.x +
			sign *
				(r.dx * b.scale +
					(r.point.x - sheet.frameWidth / 2) * (b.scale - a.scale));
		const dy =
			b.y -
			a.y +
			r.dy * b.scale +
			(r.point.y - sheet.frameHeight) * (b.scale - a.scale);
		phase.bodyTravel += Math.hypot(b.x - a.x, b.y - a.y);
		phase.drift += Math.hypot(dx, dy);
		phase.dx += dx;
		phase.dy += dy;
		phase.maxDrift = Math.max(phase.maxDrift, Math.hypot(phase.dx, phase.dy));
		phase.pairs++;
		phase.last = i;
	}
	const ratios = phases
		.map((p) => (p.bodyTravel > 0 ? p.drift / p.bodyTravel : Infinity))
		.sort((a, b) => a - b);
	const percentile = (p) =>
		ratios.length
			? ratios[Math.min(ratios.length - 1, Math.floor(ratios.length * p))]
			: null;
	const median = percentile(0.5),
		p90 = percentile(0.9);
	const maxStanceDrift = Math.max(0, ...phases.map((p) => p.maxDrift));
	return {
		median,
		p90,
		maxStanceDrift,
		phases,
		acceptance:
			phases.length > 0 &&
			median <= 0.05 &&
			p90 <= 0.15 &&
			maxStanceDrift <= 1.5,
	};
}
