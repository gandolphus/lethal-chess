#!/usr/bin/env node
// Builds static/openings/catalog.json from lichess-org/chess-openings (CC0).
// Every line is replayed through chess.js so SAN drift between the catalog and
// the rules engine the app uses fails the build instead of a drill.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'static', 'openings', 'catalog.json');
const base = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master';

// EPD = the first four FEN fields. Move counters would split transpositions.
const epd = (fen) => fen.split(' ').slice(0, 4).join(' ');

const lines = [];
const failures = [];

for (const file of ['a', 'b', 'c', 'd', 'e']) {
	const response = await fetch(`${base}/${file}.tsv`);
	if (!response.ok) throw new Error(`${file}.tsv: HTTP ${response.status}`);
	const rows = (await response.text()).trim().split('\n').slice(1);

	for (const row of rows) {
		const [eco, name, pgn] = row.split('\t');
		const chess = new Chess();
		const uci = [];
		try {
			for (const token of pgn.split(/\s+/)) {
				if (/^\d+\.+$/.test(token)) continue;
				const move = chess.move(token);
				uci.push(move.from + move.to + (move.promotion ?? ''));
			}
		} catch (error) {
			failures.push(`${eco} ${name}: ${pgn} (${error.message})`);
			continue;
		}
		lines.push({ eco, name, pgn, uci: uci.join(' '), epd: epd(chess.fen()) });
	}
}

if (failures.length) {
	console.error(`catalog: ${failures.length} lines failed to replay:\n  ${failures.join('\n  ')}`);
	process.exit(1);
}

const terminals = new Map();
for (const line of lines) terminals.set(line.epd, (terminals.get(line.epd) ?? 0) + 1);
const collisions = [...terminals.values()].filter((count) => count > 1).length;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(
	out,
	JSON.stringify({
		source: 'https://github.com/lichess-org/chess-openings',
		license: 'CC0-1.0',
		generated: new Date().toISOString(),
		lines
	})
);

console.log(`catalog: ${lines.length} lines, ${terminals.size} terminal positions, ${collisions} shared`);
