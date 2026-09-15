// Checks the shipped bundles themselves, not just the builder: a bad rebuild fails here before it deploys.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import type { Bundle, OpeningIndexEntry } from '../../src/lib/drill/bundle.ts';
import { toEpd } from '../lib/codec.ts';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'static', 'openings', 'repertoires');
const index: OpeningIndexEntry[] = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));

const after = (epd: string, uci: string) => {
	const chess = new Chess(`${epd} 0 1`);
	chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
	return toEpd(chess.fen());
};

describe.each(index.map((entry) => entry.id))('bundle %s', (id) => {
	const bundle: Bundle = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8'));

	it('has no repetition cycles, so every walk ends', () => {
		const onPath = new Set<string>();
		const done = new Set<string>();
		const cycles: string[] = [];
		const visit = (epd: string) => {
			const node = bundle.nodes[epd];
			if (!node || done.has(epd)) return;
			if (onPath.has(epd)) {
				cycles.push(epd);
				return;
			}
			onPath.add(epd);
			if (node.move) visit(after(epd, node.move.uci));
			for (const reply of node.replies ?? []) visit(after(epd, reply.uci));
			onPath.delete(epd);
			done.add(epd);
		};
		visit(bundle.rootEpd);
		expect(cycles).toEqual([]);
	});

	it('drills only replies that lead to a decision, with weights summing to 1', () => {
		for (const node of Object.values(bundle.nodes)) {
			if (!node.replies) continue;
			expect(node.replies.reduce((sum, r) => sum + r.weight, 0)).toBeCloseTo(1);
			for (const reply of node.replies) expect(bundle.nodes[after(node.epd, reply.uci)]?.move).toBeDefined();
		}
	});

	it('has legal book lines that continue the opening’s defining moves', () => {
		const opening = (bundle.openingMoves ?? []).join(' ');
		for (const line of bundle.lines ?? []) {
			expect(line.moves.join(' ').startsWith(`${opening} `)).toBe(true);
			expect(line.entry).toBeGreaterThan(bundle.openingMoves?.length ?? 0);
			expect(line.entry).toBeLessThanOrEqual(line.moves.length);
			const chess = new Chess();
			for (const uci of line.moves) chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
		}
	});
});
