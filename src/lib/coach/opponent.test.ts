import { describe, expect, it } from 'vitest';
import type { AnalysisLine } from '$lib/chess/engine';
import { drawFlavour, humanMix, humanReply, pickFlavoured, type Flavour } from './opponent';

/** mulberry32: a small seeded generator, so the mix can be measured exactly. */
function seeded(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const line = (move: string, cp: number): AnalysisLine => ({ move, score: { cp }, pv: [move], depth: 20 });

// White to move, best first. Win-chance losses against +30: 0, 0.01, 0.04 | 0.1, 0.19 | 0.34, 0.5.
const SPREAD = [line('e2e4', 30), line('d2d4', 25), line('c2c4', 8), line('g1f3', -25), line('f2f3', -75), line('g2g4', -160), line('h2h4', -270)];

function shares(draws: number, pick: () => Flavour): Record<Flavour, number> {
	const count: Record<Flavour, number> = { theory: 0, middle: 0, junk: 0 };
	for (let i = 0; i < draws; i++) count[pick()]++;
	return { theory: count.theory / draws, middle: count.middle / draws, junk: count.junk / draws };
}

describe('humanMix', () => {
	it('starts on theory and drifts toward improvising as the round goes on', () => {
		const start = humanMix(0);
		const late = humanMix(7);
		expect(start.theory + start.middle + start.junk).toBeCloseTo(1);
		expect(late.theory + late.middle + late.junk).toBeCloseTo(1);
		expect(start.theory).toBeCloseTo(0.75);
		expect(start.junk).toBeCloseTo(0.05);
		expect(late.theory).toBeLessThan(0.2);
		expect(late.junk).toBeGreaterThan(0.2);
		// The dangerous middle is the mode's reason to exist: by mid-round it is the most likely flavour.
		expect(humanMix(3).middle).toBeGreaterThan(humanMix(3).theory);
		expect(humanMix(3).middle).toBeGreaterThan(humanMix(3).junk);
	});

	it('draws flavours in the mix’s proportions', () => {
		const random = seeded(7);
		const start = shares(20_000, () => drawFlavour(0, random));
		expect(start.theory).toBeCloseTo(0.75, 1);
		expect(start.junk).toBeCloseTo(0.05, 1);
		const late = shares(20_000, () => drawFlavour(7, random));
		expect(late.theory).toBeCloseTo(humanMix(7).theory, 1);
		expect(late.junk).toBeCloseTo(humanMix(7).junk, 1);
	});
});

describe('pickFlavoured', () => {
	it('picks within the band, and nothing when the band is empty', () => {
		const random = seeded(1);
		const seen = new Set<string>();
		for (let i = 0; i < 200; i++) seen.add(pickFlavoured(SPREAD, 'w', 'middle', random)!.line.move);
		expect([...seen].sort()).toEqual(['f2f3', 'g1f3']);
		for (let i = 0; i < 200; i++) expect(['g2g4', 'h2h4']).toContain(pickFlavoured(SPREAD, 'w', 'junk', random)!.line.move);
		expect(pickFlavoured(SPREAD.slice(0, 3), 'w', 'junk', random)).toBeNull();
		expect(pickFlavoured(SPREAD.slice(0, 3), 'w', 'middle', random)).toBeNull();
	});

	it('favours the lesser evil: the mild blunder over the hung piece', () => {
		const random = seeded(3);
		const count = { g2g4: 0, h2h4: 0 };
		for (let i = 0; i < 2000; i++) count[pickFlavoured(SPREAD, 'w', 'junk', random)!.line.move as 'g2g4' | 'h2h4']++;
		expect(count.g2g4).toBeGreaterThan(count.h2h4);
	});

	it('reads losses from the mover’s side', () => {
		// Black to move: the best line is the lowest cp.
		const black = [line('e7e5', -30), line('c7c5', -20), line('f7f6', 100), line('g7g5', 200)];
		const random = seeded(5);
		expect(pickFlavoured(black, 'b', 'theory', random)!.loss).toBeLessThan(0.06);
		expect(pickFlavoured(black, 'b', 'middle', random)!.line.move).toBe('f7f6');
		expect(pickFlavoured(black, 'b', 'junk', random)!.line.move).toBe('g7g5');
	});
});

describe('humanReply', () => {
	it('is not deterministic, and only ever plays a move from the list', () => {
		const random = seeded(11);
		const seen = new Set<string>();
		for (let i = 0; i < 300; i++) {
			const { line } = humanReply(SPREAD, 'w', { move: 3, random });
			expect(SPREAD).toContain(line);
			seen.add(line.move);
		}
		expect(seen.size).toBeGreaterThanOrEqual(4);
	});

	it('lands in the mix’s bands over many draws', () => {
		const random = seeded(13);
		const early = shares(10_000, () => humanReply(SPREAD, 'w', { move: 0, random }).kind);
		expect(early.theory).toBeGreaterThan(0.7);
		expect(early.theory).toBeLessThan(0.8);
		expect(early.junk).toBeLessThan(0.08);
		const late = shares(10_000, () => humanReply(SPREAD, 'w', { move: 6, random }).kind);
		expect(late.middle).toBeGreaterThan(0.5);
		expect(late.junk).toBeGreaterThan(0.18);
		expect(late.theory).toBeLessThan(0.25);
	});

	it('falls down to a milder flavour when the list has none of the one drawn', () => {
		const random = seeded(17);
		const sound = SPREAD.slice(0, 3);
		for (let i = 0; i < 200; i++) expect(humanReply(sound, 'w', { move: 7, random }).kind).toBe('theory');
		const noJunk = SPREAD.slice(0, 5);
		const kinds = shares(2000, () => humanReply(noJunk, 'w', { move: 7, random }).kind);
		expect(kinds.junk).toBe(0);
		expect(kinds.middle).toBeGreaterThan(0.7);
		expect(humanReply([line('e2e4', 0)], 'w', { move: 7, random, flavour: 'junk' })).toMatchObject({ kind: 'theory', loss: 0 });
	});
});
