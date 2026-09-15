// Human-readable view of a built bundle: the main line (always following the
// heaviest reply) and the replies drilled at the first opponent decisions.
//
//   node pipeline/repertoire/inspect.ts ruy-lopez

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import type { Bundle } from '../../src/lib/drill/bundle.ts';
import { toEpd } from '../lib/codec.ts';

const id = process.argv[2] ?? 'ruy-lopez';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const bundle: Bundle = JSON.parse(readFileSync(join(root, 'static', 'openings', 'repertoires', `${id}.json`), 'utf8'));

const chess = new Chess();
for (const uci of bundle.rootMoves) chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) });

const fmt = (score: { cp: number } | { mate: number }) =>
	'mate' in score ? `#${score.mate}` : `${score.cp >= 0 ? '+' : ''}${(score.cp / 100).toFixed(2)}`;

console.log(`${bundle.name} (${bundle.side === 'w' ? 'White' : 'Black'}) — root: ${chess.history().join(' ')}\n`);
console.log('Main line (heaviest replies):');

let name = '';
let shownBranches = 0;
for (let step = 0; step < 24; step++) {
	const node = bundle.nodes[toEpd(chess.fen())];
	if (!node) break;
	if (node.name && node.name !== name) {
		name = node.name;
		console.log(`    — ${name}`);
	}
	const moveNo = `${Math.floor(node.ply / 2) + 1}${node.ply % 2 ? '...' : '.'}`;
	if (node.move) {
		console.log(`  ${moveNo} ${node.move.san}  (you; eval ${fmt(node.move.score)}, best ${node.candidates[0].san} ${fmt(node.candidates[0].score)}, depth ${node.depth})`);
		chess.move(node.move.san);
	} else if (node.replies?.length) {
		const replies = [...node.replies].sort((a, b) => b.weight - a.weight);
		if (shownBranches++ < 4) {
			console.log(`  ${moveNo} opponent replies: ${replies.map((r) => `${r.san} ${(r.weight * 100).toFixed(0)}%`).join(', ')}  (sharpness ${node.sharpness ?? '-'})`);
		}
		chess.move(replies[0].san);
	} else break;
}
console.log(`\n${Object.keys(bundle.nodes).length} nodes; stats ${JSON.stringify(bundle.stats)}`);
