// Correctness audit 2026-09-16: the shipped bundles against the definitions in the vault's
// Exploration Mode note. Tests marked `.fails` demonstrate a gap that stands today.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { scoreFor, type Bundle, type OpeningIndexEntry, type Side } from '../../src/lib/drill/bundle.ts';
import { toEpd } from '../lib/codec.ts';
import { buildCatalogIndex, type CatalogLine } from './catalog-index.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = join(root, 'static', 'openings', 'repertoires');
const index: OpeningIndexEntry[] = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
const catalog: CatalogLine[] = JSON.parse(readFileSync(join(root, 'static', 'openings', 'catalog.json'), 'utf8')).lines;
const theory = buildCatalogIndex(catalog);

const epdsOf = (moves: string[]) => {
	const chess = new Chess();
	const epds = [toEpd(chess.fen())];
	for (const uci of moves) {
		chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
		epds.push(toEpd(chess.fen()));
	}
	return epds;
};

const bundles = index.map(({ id }) => JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8')) as Bundle);

describe('shipped lines against the definition of a line', () => {
	// Exploration Mode: "A line. A catalog line with no catalogued continuation: its end is where theory
	// stops." buildLines decides that by UCI-string prefix, so a line whose end position the catalog
	// continues by another move order still counts as an end. 61 of 1,777 ends are continued by 124
	// catalog lines — 41 of them inside the same bundle, so following the longer line celebrates the
	// shorter one in the middle of it.
	it.fails('every line ends where the catalogued theory stops, by position', () => {
		const continued: string[] = [];
		for (const bundle of bundles) {
			for (const line of bundle.lines ?? []) {
				const end = epdsOf(line.moves).at(-1)!;
				const next = theory.children(end);
				if (next.length) continued.push(`${bundle.id}: ${line.name} → ${next.map((c) => c.uci).join(' / ')}`);
			}
		}
		expect(continued).toEqual([]);
	});

	// A key is the EPD of the line's end; two lines on one key would share a stage. None do.
	it('gives every line its own key', () => {
		for (const bundle of bundles) {
			const keys = (bundle.lines ?? []).map((line) => epdsOf(line.moves).at(-1)!);
			expect(new Set(keys).size).toBe(keys.length);
		}
	});
});

describe('shipped nodes', () => {
	// The session grades against candidates[0] as the best move; the builder keeps the eval db's
	// order. Every node's first candidate is the mover's best.
	it('lists candidates best first for the side to move', () => {
		for (const bundle of bundles) {
			for (const node of Object.values(bundle.nodes)) {
				const mover = node.epd.split(' ')[1] as Side;
				const best = scoreFor(node.candidates[0].score, mover);
				for (const candidate of node.candidates) expect(scoreFor(candidate.score, mover)).toBeLessThanOrEqual(best);
			}
		}
	});
});
