import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build, chooseEval } from './build.ts';
import { EvalCache } from './reader.ts';

const KG = 'rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR b KQkq -';
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
const ENDGAME = '8/4r3/2R2pk1/6pp/3P4/6P1/5K1P/8 b - -';

const fixture = [
	{
		fen: KG,
		evals: [
			// Deepest search, but only one candidate move.
			{ depth: 54, knodes: 1, pvs: [{ cp: -39, line: 'e5f4 g1f3 g8f6 b1c3 d7d5' }] },
			// Within slack and multi-PV: this is the one precision metrics need.
			{ depth: 50, knodes: 1, pvs: [{ cp: -35, line: 'e5f4 g1f3' }, { cp: -12, line: 'd7d5 e4d5' }, { cp: 9, line: 'c7c6 g1f3' }] },
			// Most candidates, but too shallow to trust next to the others.
			{ depth: 20, knodes: 1, pvs: Array.from({ length: 5 }, () => ({ cp: 0, line: 'a7a6' })) }
		]
	},
	{ fen: START, evals: [{ depth: 60, knodes: 1, pvs: [{ cp: 18, line: 'e2e4 e7e5 g1f3' }, { mate: 3, line: 'd2d4' }] }] },
	// Filtered out: too few pieces.
	{ fen: ENDGAME, evals: [{ depth: 58, knodes: 1, pvs: [{ cp: 0, line: 'e7a7' }] }] }
];

let dir: string;
let cache: EvalCache;

beforeAll(async () => {
	dir = mkdtempSync(join(tmpdir(), 'eval-cache-'));
	const source = join(dir, 'source.jsonl');
	// A truncated final line, as a partial download would leave behind.
	writeFileSync(source, fixture.map((line) => JSON.stringify(line)).join('\n') + '\n{"fen":"rnbqkbnr/ppp');
	await build(source, join(dir, 'cache'), 26);
	cache = new EvalCache(join(dir, 'cache'));
});

afterAll(() => {
	cache?.close();
	rmSync(dir, { recursive: true, force: true });
});

describe('eval cache', () => {
	it('keeps opening-phase positions and drops the rest', () => {
		expect(cache.size).toBe(2);
		expect(cache.get(ENDGAME)).toBeNull();
	});

	it('stores the multi-PV search within depth slack, not merely the deepest', () => {
		const record = cache.get(KG);
		expect(record?.depth).toBe(50);
		expect(record?.pvs).toEqual([
			{ move: 'e5f4', score: { cp: -35 } },
			{ move: 'd7d5', score: { cp: -12 } },
			{ move: 'c7c6', score: { cp: 9 } }
		]);
	});

	it('reconstructs the principal variation including its first move', () => {
		expect(cache.get(START)?.line).toEqual(['e2e4', 'e7e5', 'g1f3']);
	});

	it('preserves mate scores', () => {
		expect(cache.get(START)?.pvs[1]).toEqual({ move: 'd2d4', score: { mate: 3 } });
	});

	it('returns null for an unknown position', () => {
		expect(cache.get('8/8/8/8/8/8/8/K6k w - -')).toBeNull();
	});
});

describe('chooseEval', () => {
	it('ignores evals without candidate moves', () => {
		expect(chooseEval([{ depth: 99, pvs: [] }])).toBeNull();
	});
});
