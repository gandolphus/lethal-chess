// Coverage of the full eval cache over every position on every catalog line,
// plus spot checks on positions whose evals we know from the cloud-eval API.
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { EvalCache } from './reader.ts';
import { toEpd } from '../lib/codec.ts';
import { normalizeCastling } from '../lib/uci.ts';

const root = '/home/ohzo/projects/lethal-chess';
const cache = new EvalCache(`${root}/data/cache/evals`);
const { lines } = JSON.parse(readFileSync(`${root}/static/openings/catalog.json`, 'utf8'));

// Every distinct position along every catalog line (including the start position).
const positions = new Map<string, { ply: number; family: string }>();
for (const line of lines) {
	const chess = new Chess();
	const family = line.name.split(':')[0];
	const record = (ply: number) => {
		const epd = toEpd(chess.fen());
		if (!positions.has(epd)) positions.set(epd, { ply, family });
	};
	record(0);
	line.uci.split(' ').forEach((uci: string, i: number) => {
		chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
		record(i + 1);
	});
}

let hits = 0, multi = 0, deep = 0, castlingSeen = 0, castlingLegal = 0;
const byPly = new Map<number, [number, number]>();
const byFamily = new Map<string, [number, number]>();
const t0 = performance.now();
for (const [epd, { ply, family }] of positions) {
	const record = cache.get(epd);
	const bucket = Math.min(ply, 20);
	const p = byPly.get(bucket) ?? [0, 0];
	p[1]++;
	const f = byFamily.get(family) ?? [0, 0];
	f[1]++;
	if (record) {
		hits++; p[0]++; f[0]++;
		if (record.pvs.length >= 3) multi++;
		if (record.depth >= 30) deep++;
		// Every cached move must be legal once castling is normalised.
		const chess = new Chess(`${epd} 0 1`);
		for (const pv of record.pvs) {
			const raw = pv.move;
			const move = normalizeCastling(chess, raw);
			if (move !== raw) castlingSeen++;
			try {
				new Chess(`${epd} 0 1`).move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
				if (move !== raw) castlingLegal++;
			} catch {
				console.log(`ILLEGAL cached move ${raw} → ${move} in ${epd}`);
			}
		}
	}
	byPly.set(bucket, p);
	byFamily.set(family, f);
}
const ms = performance.now() - t0;

console.log(`catalog positions: ${positions.size}; in cache: ${hits} (${((hits / positions.size) * 100).toFixed(1)}%)`);
console.log(`  of hits: ${((multi / hits) * 100).toFixed(1)}% have ≥3 candidate moves, ${((deep / hits) * 100).toFixed(1)}% depth ≥ 30`);
console.log(`  castling moves normalised: ${castlingSeen}, legal after normalising: ${castlingLegal}`);
console.log(`  ${((ms / positions.size) * 1000).toFixed(0)} µs per lookup+validation at full scale`);
console.log('coverage by ply:', [...byPly].sort((a, b) => a[0] - b[0]).map(([k, [h, t]]) => `${k}:${Math.round((h / t) * 100)}%`).join(' '));
for (const family of ["Ruy Lopez", "Italian Game", "English Opening", "Sicilian Defense", "Caro-Kann Defense", "King's Gambit"]) {
	const [h, t] = byFamily.get(family) ?? [0, 0];
	console.log(`  ${family}: ${h}/${t} (${t ? Math.round((h / t) * 100) : 0}%)`);
}
const kg = cache.get('rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR b KQkq -');
console.log('KG spot check (cloud eval said exf4 -39, d5 -12, c6 +9):', JSON.stringify(kg?.pvs.slice(0, 3)), 'depth', kg?.depth);
