import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { toEpd } from '../lib/codec.ts';
import type { EvalRecord } from '../eval-cache/format.ts';
import { breakCycles, buildRepertoire, chooseReplies, sharpness, type EvalSource } from './build.ts';
import { buildCatalogIndex, type CatalogLine } from './catalog-index.ts';
import type { RepertoireSpec } from './spec.ts';
import type { BundleNode } from '../../src/lib/drill/bundle.ts';

const epdAfter = (...moves: string[]) => {
	const chess = new Chess();
	for (const m of moves) chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
	return toEpd(chess.fen());
};

const catalogLine = (name: string, ...moves: string[]): CatalogLine => ({
	eco: 'X00',
	name,
	pgn: '',
	uci: moves.join(' '),
	epd: epdAfter(...moves)
});

const cp = (move: string, value: number) => ({ move, score: { cp: value } });

const spec: RepertoireSpec = {
	id: 'test',
	name: 'Test',
	group: 'white-e4',
	tags: [],
	side: 'w',
	rootMoves: ['e2e4', 'e7e5'],
	maxPly: 6,
	learnerBudget: 50,
	soundCp: 35,
	replyCp: 60,
	maxReplies: 4
};

function source(table: Record<string, EvalRecord['pvs']>): EvalSource {
	return (epd) => (table[epd] ? { depth: 30, pvs: table[epd], line: [table[epd][0].move] } : null);
}

describe('buildRepertoire', () => {
	it('prefers the theory move when it is sound, even if the engine slightly prefers another', () => {
		const catalog = buildCatalogIndex([catalogLine("King's Knight Opening", 'e2e4', 'e7e5', 'g1f3')]);
		const bundle = buildRepertoire(
			spec,
			source({ [epdAfter('e2e4', 'e7e5')]: [cp('b1c3', 40), cp('g1f3', 30)] }),
			catalog
		);
		expect(bundle.nodes[epdAfter('e2e4', 'e7e5')].move?.san).toBe('Nf3');
	});

	it('falls back to the engine move when the theory move is not sound', () => {
		const catalog = buildCatalogIndex([catalogLine('Dubious', 'e2e4', 'e7e5', 'd1h5')]);
		const bundle = buildRepertoire(
			spec,
			source({ [epdAfter('e2e4', 'e7e5')]: [cp('g1f3', 40), cp('d1h5', -30)] }),
			catalog
		);
		expect(bundle.nodes[epdAfter('e2e4', 'e7e5')].move?.san).toBe('Nf3');
	});

	it('drills sound engine replies plus catalogued dubious ones, with weights summing to 1', () => {
		const afterNf3 = epdAfter('e2e4', 'e7e5', 'g1f3');
		const catalog = buildCatalogIndex([
			catalogLine("King's Knight Opening", 'e2e4', 'e7e5', 'g1f3'),
			catalogLine('Elephant Gambit', 'e2e4', 'e7e5', 'g1f3', 'd7d5')
		]);
		const bundle = buildRepertoire(
			spec,
			source({
				[epdAfter('e2e4', 'e7e5')]: [cp('g1f3', 30)],
				// White's point of view: Nc6 and Nf6 are sound for Black; d5 is dubious (+150).
				[afterNf3]: [cp('b8c6', 25), cp('g8f6', 40), cp('d7d5', 150), cp('f7f6', 300)],
				// Positions below each reply, so the drilled replies lead to real decisions.
				[epdAfter('e2e4', 'e7e5', 'g1f3', 'b8c6')]: [cp('f1b5', 30)],
				[epdAfter('e2e4', 'e7e5', 'g1f3', 'g8f6')]: [cp('f3e5', 30)],
				[epdAfter('e2e4', 'e7e5', 'g1f3', 'd7d5')]: [cp('e4d5', 150)]
			}),
			catalog
		);
		const replies = bundle.nodes[afterNf3].replies!;
		expect(replies.map((r) => r.san).sort()).toEqual(['Nc6', 'Nf6', 'd5']);
		expect(replies.reduce((sum, r) => sum + r.weight, 0)).toBeCloseTo(1);
		// Sharpness is from the mover's side: for Black, Nc6 (−25) beats the second-best Nf6 (−40) by 15.
		expect(bundle.nodes[afterNf3].sharpness).toBe(15);
	});

	it('normalises king-takes-rook castling from the eval db into legal SAN', () => {
		const castleReady = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5'];
		const bundle = buildRepertoire(
			{ ...spec, rootMoves: castleReady, maxPly: 10 },
			source({ [epdAfter(...castleReady)]: [cp('e1h1', 20)] }),
			buildCatalogIndex([])
		);
		expect(bundle.nodes[epdAfter(...castleReady)].move).toMatchObject({ uci: 'e1g1', san: 'O-O' });
	});

	it('counts missing evals and never drills a reply into a position it has no data for', () => {
		const table = {
			[epdAfter('e2e4', 'e7e5')]: [cp('g1f3', 30)],
			[epdAfter('e2e4', 'e7e5', 'g1f3')]: [cp('b8c6', 30), cp('g8f6', 30)]
			// Both replies lead to positions with no eval.
		};
		const bundle = buildRepertoire(spec, source(table), buildCatalogIndex([]));
		// 2 below the tree + 2 prelude positions (start, after 1.e4) the table doesn't cover.
		expect(bundle.stats.missingEvals).toBe(4);
		// The opponent node lost all its replies, so the learner's Nf3 ends the line.
		expect(bundle.nodes[epdAfter('e2e4', 'e7e5', 'g1f3')].replies).toBeUndefined();
	});

	it('shares one node between genuine transpositions', () => {
		// 1.e4 e5 2.Nf3 Nc6 3.Nc3 and 1.e4 e5 2.Nc3 Nc6 3.Nf3 reach the same position.
		const via = (...moves: string[]) => epdAfter('e2e4', 'e7e5', ...moves);
		const shared = via('g1f3', 'b8c6', 'b1c3');
		expect(via('b1c3', 'b8c6', 'g1f3')).toBe(shared);

		const table = {
			[via()]: [cp('g1f3', 30)],
			[via('g1f3')]: [cp('b8c6', 30)],
			[via('g1f3', 'b8c6')]: [cp('b1c3', 30)],
			[shared]: [cp('g8f6', 30)],
			[via('g1f3', 'b8c6', 'b1c3', 'g8f6')]: [cp('f1b5', 30)]
		};
		const bundle = buildRepertoire({ ...spec, maxPly: 10 }, source(table), buildCatalogIndex([]));
		expect(Object.keys(bundle.nodes).filter((epd) => epd === shared)).toHaveLength(1);
		expect(bundle.nodes[shared].replies?.map((r) => r.san)).toEqual(['Nf6']);
	});

	it('prunes replies that lead nowhere, renormalises weights, and removes unreachable nodes', () => {
		const table = {
			[epdAfter('e2e4', 'e7e5')]: [cp('g1f3', 30)],
			[epdAfter('e2e4', 'e7e5', 'g1f3')]: [cp('b8c6', 30), cp('g8f6', 35), cp('d7d6', 40)],
			[epdAfter('e2e4', 'e7e5', 'g1f3', 'b8c6')]: [cp('f1b5', 30)],
			[epdAfter('e2e4', 'e7e5', 'g1f3', 'g8f6')]: [cp('f3e5', 30)]
			// ...d6 has no eval: its reply must go.
		};
		const bundle = buildRepertoire(spec, source(table), buildCatalogIndex([]));
		const replies = bundle.nodes[epdAfter('e2e4', 'e7e5', 'g1f3')].replies!;
		expect(replies.map((r) => r.san).sort()).toEqual(['Nc6', 'Nf6']);
		expect(replies.reduce((sum, r) => sum + r.weight, 0)).toBeCloseTo(1);

		for (const node of Object.values(bundle.nodes)) {
			for (const reply of node.replies ?? []) {
				const chess = new Chess(`${node.epd} 0 1`);
				chess.move({ from: reply.uci.slice(0, 2), to: reply.uci.slice(2, 4) });
				expect(bundle.nodes[toEpd(chess.fen())]?.move).toBeDefined();
			}
		}
	});

	it('seats every sound engine reply before thin catalogued theory', () => {
		const fen = `${epdAfter('e2e4', 'e7e5', 'g1f3')} 1 2`;
		const candidates = [
			{ uci: 'b8c6', san: 'Nc6', score: { cp: 25 } },
			{ uci: 'g8f6', san: 'Nf6', score: { cp: 35 } },
			{ uci: 'd7d6', san: 'd6', score: { cp: 45 } },
			{ uci: 'f7f6', san: 'f6', score: { cp: 250 } }
		];
		const thinTheory = [{ uci: 'f7f6', epd: '', lines: 1 }];

		const full = chooseReplies(fen, candidates, thinTheory, 'b', 60, 3);
		expect(full.map((r) => r.san)).toEqual(['Nc6', 'Nf6', 'd6']); // no seat left for the dubious line

		const roomy = chooseReplies(fen, candidates, thinTheory, 'b', 60, 4);
		expect(roomy.map((r) => r.san)).toEqual(['Nc6', 'Nf6', 'd6', 'f6']);
		expect(roomy.at(-1)!.weight).toBeLessThan(roomy[2].weight); // thin theory never outweighs a sound reply
	});

	it('caps sharpness so a mate score cannot read as a 100,000 cp gap', () => {
		const mateVsCp = [
			{ uci: 'd8h4', san: 'Qh4#', score: { mate: -1 } },
			{ uci: 'b8c6', san: 'Nc6', score: { cp: 30 } }
		];
		expect(sharpness(mateVsCp, 'b')).toBe(1000);
		expect(sharpness([{ uci: 'a', san: 'a', score: { cp: 0 } }, { uci: 'b', san: 'b', score: { cp: -40 } }], 'w')).toBe(40);
	});

	it('removes duplicate PVs from the eval db', () => {
		const bundle = buildRepertoire(
			{ ...spec, learnerBudget: 1 },
			source({ [epdAfter('e2e4', 'e7e5')]: [cp('g1f3', 30), cp('b1c3', 40), cp('b1c3', 40), cp('d2d4', 45)] }),
			buildCatalogIndex([])
		);
		expect(bundle.nodes[epdAfter('e2e4', 'e7e5')].candidates.map((c) => c.san)).toEqual(['Nf3', 'Nc3', 'd4']);
	});

	it('respects the learner budget', () => {
		const table: Record<string, EvalRecord['pvs']> = {};
		const bundle = buildRepertoire({ ...spec, learnerBudget: 1 }, source({
			...table,
			[epdAfter('e2e4', 'e7e5')]: [cp('g1f3', 30)],
			[epdAfter('e2e4', 'e7e5', 'g1f3')]: [cp('b8c6', 30)],
			[epdAfter('e2e4', 'e7e5', 'g1f3', 'b8c6')]: [cp('f1b5', 30)]
		}), buildCatalogIndex([]));
		// The budget limits the tree; the prelude adds the learner's defining move 1.e4 on top.
		expect(bundle.stats.learnerNodes).toBe(2);
	});
});

describe('breakCycles', () => {
	it('drops edges back into the current path, so every walk ends', () => {
		// 1.Nf3 Nf6 2.Ng1 Ng8 returns to the start: the learner's Ng1 and the reply Ng8 would loop.
		const n = (moves: string[], extra: Partial<BundleNode>): BundleNode => ({ epd: epdAfter(...moves), ply: moves.length, depth: 1, candidates: [], line: [], ...extra });
		const c = (uci: string, san: string) => ({ uci, san, score: { cp: 0 } });
		const nodes = Object.fromEntries(
			[
				n([], { move: c('g1f3', 'Nf3') }),
				n(['g1f3'], { replies: [{ uci: 'g8f6', san: 'Nf6', weight: 1 }] }),
				n(['g1f3', 'g8f6'], { move: c('f3g1', 'Ng1') }),
				n(['g1f3', 'g8f6', 'f3g1'], { replies: [{ uci: 'f6g8', san: 'Ng8', weight: 0.5 }, { uci: 'e7e5', san: 'e5', weight: 0.5 }] }),
				n(['g1f3', 'g8f6', 'f3g1', 'e7e5'], {})
			].map((node) => [node.epd, node])
		);
		breakCycles(nodes, epdAfter());
		expect(nodes[epdAfter('g1f3', 'g8f6', 'f3g1')].replies).toEqual([{ uci: 'e7e5', san: 'e5', weight: 1 }]);
		expect(nodes[epdAfter()].move?.san).toBe('Nf3');
	});
});

describe('book lines', () => {
	const ruy = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'];
	const ruySpec = { ...spec, rootMoves: ruy };
	const catalogLines = [
		catalogLine('Ruy Lopez', ...ruy),
		catalogLine('Ruy Lopez: Morphy Defense', ...ruy, 'a7a6'),
		catalogLine('Ruy Lopez: Morphy Defense, Exchange', ...ruy, 'a7a6', 'b5c6'),
		catalogLine('Ruy Lopez: Closed', ...ruy, 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f8e7'),
		catalogLine('Ruy Lopez: Cozio Defense', ...ruy, 'g8e7'),
		catalogLine('Italian Game', 'e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4')
	];

	function build(table: Record<string, EvalRecord['pvs']> = {}) {
		return buildRepertoire(ruySpec, source(table), buildCatalogIndex(catalogLines), 0, catalogLines);
	}

	it('lists only lines with no catalogued continuation, under the defining moves', () => {
		expect(build().lines!.map((l) => l.name)).toEqual([
			'Ruy Lopez: Morphy Defense, Exchange',
			'Ruy Lopez: Closed',
			'Ruy Lopez: Cozio Defense'
		]);
	});

	it('enters a line at its deepest named position before the end, else at the end', () => {
		const [exchange, closed, cozio] = build().lines!;
		expect(exchange).toMatchObject({ entry: 6, entryName: 'Ruy Lopez: Morphy Defense', variation: 'Ruy Lopez: Morphy Defense' });
		expect(closed).toMatchObject({ entry: 6, entryName: 'Ruy Lopez: Morphy Defense', moves: [...ruy, 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f8e7'] });
		// The defining position is named too, but it is where every line starts, not an entrance.
		expect(cozio.entry).toBe(6);
		expect(cozio.entryName).toBeUndefined();
	});

	it('does not treat a later position that repeats the opening’s own name as an entrance', () => {
		const lines = [...catalogLines, catalogLine('Ruy Lopez', ...ruy, 'g8f6'), catalogLine('Ruy Lopez: Berlin, Long', ...ruy, 'g8f6', 'e1g1', 'f6e4')];
		const bundle = buildRepertoire(ruySpec, source({}), buildCatalogIndex(lines), 0, lines);
		expect(bundle.lines!.find((l) => l.name.endsWith('Long'))).toMatchObject({ entry: 8 });
	});

	it('marks a line dubious when it takes a learner move the coach calls a mistake', () => {
		const lines = build({
			[epdAfter(...ruy, 'a7a6')]: [cp('b5a4', 30), cp('b5c6', -150)]
		}).lines!;
		expect(lines.find((l) => l.name.endsWith('Exchange'))!.dubious).toBe(true);
		expect(lines.find((l) => l.name.endsWith('Closed'))!.dubious).toBe(false);
	});

	it('adds a node for every book position that has an eval, without drill moves', () => {
		const afterA6 = epdAfter(...ruy, 'a7a6');
		const bundle = build({ [afterA6]: [cp('b5a4', 30)] });
		expect(bundle.nodes[afterA6]).toMatchObject({ name: 'Ruy Lopez: Morphy Defense', ply: 6 });
		expect(bundle.nodes[afterA6].move).toBeUndefined();
		expect(bundle.nodes[afterA6].replies).toBeUndefined();
		expect(bundle.stats.bookNodes).toBe(1);
	});
});

describe('prelude', () => {
	it('starts walks from the initial position, asking the learner the moves that lead into the opening', () => {
		const table = {
			[epdAfter()]: [cp('e2e4', 30), cp('d2d4', 25)],
			[epdAfter('e2e4')]: [cp('c7c5', 30), cp('e7e5', 25)],
			[epdAfter('e2e4', 'e7e5')]: [cp('g1f3', 30)],
			[epdAfter('e2e4', 'e7e5', 'g1f3')]: [cp('b8c6', 30)],
			[epdAfter('e2e4', 'e7e5', 'g1f3', 'b8c6')]: [cp('f1b5', 30)]
		};
		const bundle = buildRepertoire({ ...spec, maxPly: 6 }, source(table), buildCatalogIndex([]));
		expect(bundle.rootMoves).toEqual([]);
		expect(bundle.openingMoves).toEqual(['e2e4', 'e7e5']);
		expect(bundle.rootEpd).toBe(epdAfter());
		// Learner's move 1 is the defining e4; the opponent's only reply is the defining e5 — even though
		// the engine preferred c5 there.
		expect(bundle.nodes[epdAfter()].move?.san).toBe('e4');
		expect(bundle.nodes[epdAfter('e2e4')].replies).toEqual([{ uci: 'e7e5', san: 'e5', weight: 1 }]);
		// The tree continues from where the opening is defined.
		expect(bundle.nodes[epdAfter('e2e4', 'e7e5')].move?.san).toBe('Nf3');
	});

	it('keeps a defining move the engine never listed, scored from the position it leads to', () => {
		const table = {
			[epdAfter()]: [cp('d2d4', 30)], // e4 not among the candidates
			[epdAfter('e2e4')]: [cp('e7e5', 20)],
			[epdAfter('e2e4', 'e7e5')]: [cp('g1f3', 30)]
		};
		const bundle = buildRepertoire(spec, source(table), buildCatalogIndex([]));
		expect(bundle.nodes[epdAfter()].move).toMatchObject({ uci: 'e2e4', san: 'e4', score: { cp: 20 } });
		expect(bundle.nodes[epdAfter()].candidates.map((c) => c.san)).toEqual(['d4', 'e4']);
	});
});
