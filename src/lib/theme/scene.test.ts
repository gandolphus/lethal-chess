import { describe, expect, it } from 'vitest';
import { swayPhase } from './scene';

describe('swayPhase', () => {
	const phases = Array.from({ length: 64 }, (_, i) => swayPhase(i));

	it('is a fraction of the cycle for every square', () => {
		for (const phase of phases) {
			expect(phase).toBeGreaterThanOrEqual(0);
			expect(phase).toBeLessThan(1);
		}
	});

	it('gives no two squares the same phase', () => {
		expect(new Set(phases.map((p) => p.toFixed(6))).size).toBe(64);
	});

	it('keeps every neighbouring pair of squares well apart in the cycle', () => {
		// Side by side (index ± 1) and one rank apart (index ± 8): the pairs the eye compares.
		const apart = (a: number, b: number) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b));
		for (let i = 0; i < 64; i++) {
			if (i % 8 !== 7) expect(apart(phases[i], phases[i + 1])).toBeGreaterThan(0.2);
			if (i < 56) expect(apart(phases[i], phases[i + 8])).toBeGreaterThan(0.05);
		}
	});
});
