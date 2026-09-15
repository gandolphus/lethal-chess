// Builds the eval cache from the Lichess eval db.
//
//   node pipeline/eval-cache/build.ts <lichess_db_eval.jsonl[.zst]> <out-dir> [--min-pieces 26]
//
// Pass 1 streams the source once, keeps opening-phase positions and scatters
// fixed-size records into 256 bucket files by key prefix. Pass 2 sorts each
// bucket in memory and concatenates them into one sorted file plus a prefix
// index. Sorting per bucket keeps memory bounded (~45 MB per bucket at full scale).

import { spawn } from 'node:child_process';
import { closeSync, createReadStream, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';
import { encodeMove, encodeScore } from '../lib/codec.ts';
import { INDEX_ENTRIES, KEY_SIZE, LINE_MOVES, MAX_PVS, RECORD_SIZE, keyOf, type Manifest } from './format.ts';

type SourcePv = { cp?: number; mate?: number; line: string };
type SourceEval = { pvs: SourcePv[]; depth: number };
type SourceLine = { fen: string; evals: SourceEval[] };

const BUCKETS = 256;
const FLUSH_BYTES = 4 * 1024 * 1024;
// Among evals within this many plies of the deepest, prefer the one with the most
// candidate moves: precision metrics need a real multi-PV search, and mixing
// scores from different searches would compare numbers that aren't comparable.
const DEPTH_SLACK = 8;

function parseArgs(argv: string[]) {
	const positional = argv.filter((arg, i) => !arg.startsWith('--') && argv[i - 1] !== '--min-pieces');
	const flag = argv.indexOf('--min-pieces');
	if (positional.length !== 2) {
		console.error('usage: build.ts <source.jsonl[.zst]> <out-dir> [--min-pieces 26]');
		process.exit(2);
	}
	return { source: positional[0], outDir: positional[1], minPieces: flag >= 0 ? Number(argv[flag + 1]) : 26 };
}

function openSource(path: string): Readable {
	if (!path.endsWith('.zst')) return createReadStream(path);
	const zstd = spawn('zstd', ['-dc', path], { stdio: ['ignore', 'pipe', 'inherit'] });
	zstd.on('exit', (code) => {
		if (code !== 0) {
			console.error(`zstd exited with ${code}`);
			process.exit(1);
		}
	});
	return zstd.stdout;
}

function piecesInFenLine(raw: string): number {
	const start = raw.indexOf('"fen":"') + 7;
	if (start < 7) return -1;
	let pieces = 0;
	for (let i = start; i < raw.length; i++) {
		const c = raw.charCodeAt(i);
		if (c === 32) return pieces; // space ends the board field
		if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) pieces++;
	}
	return -1;
}

export function chooseEval(evals: SourceEval[]): SourceEval | null {
	const usable = evals.filter((e) => e.pvs.length > 0);
	if (!usable.length) return null;
	const deepest = Math.max(...usable.map((e) => e.depth));
	return usable
		.filter((e) => e.depth >= deepest - DEPTH_SLACK)
		.reduce((best, e) =>
			e.pvs.length > best.pvs.length || (e.pvs.length === best.pvs.length && e.depth > best.depth) ? e : best
		);
}

export function encodeRecord(line: SourceLine, target: Buffer, offset: number): boolean {
	const chosen = chooseEval(line.evals);
	if (!chosen) return false;

	keyOf(line.fen).copy(target, offset);
	target.writeUInt8(Math.min(255, chosen.depth), offset + KEY_SIZE);
	const pvs = chosen.pvs.slice(0, MAX_PVS);
	target.writeUInt8(pvs.length, offset + 9);

	for (let i = 0; i < MAX_PVS; i++) {
		const at = offset + 10 + i * 4;
		const pv = pvs[i];
		if (!pv) {
			target.writeUInt16LE(0, at);
			target.writeInt16LE(0, at + 2);
			continue;
		}
		target.writeUInt16LE(encodeMove(pv.line.split(' ')[0]), at);
		target.writeInt16LE(encodeScore(pv.mate !== undefined ? { mate: pv.mate } : { cp: pv.cp ?? 0 }), at + 2);
	}

	const continuation = pvs[0].line.split(' ').slice(1, 1 + LINE_MOVES);
	for (let i = 0; i < LINE_MOVES; i++) {
		target.writeUInt16LE(continuation[i] ? encodeMove(continuation[i]) : 0, offset + 30 + i * 2);
	}
	return true;
}

async function scatter(source: string, bucketDir: string, minPieces: number) {
	const fds = Array.from({ length: BUCKETS }, (_, b) => openSync(join(bucketDir, `${b}.bin`), 'w'));
	const buffers = Array.from({ length: BUCKETS }, () => Buffer.allocUnsafe(FLUSH_BYTES + RECORD_SIZE));
	const fill = new Array<number>(BUCKETS).fill(0);
	const scratch = Buffer.alloc(RECORD_SIZE);

	let linesRead = 0;
	let malformed = 0;
	const started = Date.now();

	for await (const raw of createInterface({ input: openSource(source), crlfDelay: Infinity })) {
		linesRead++;
		if (linesRead % 10_000_000 === 0) {
			const rate = Math.round(linesRead / ((Date.now() - started) / 1000));
			console.log(`  ${(linesRead / 1e6).toFixed(0)}M lines, ${rate.toLocaleString()} lines/s`);
		}
		if (piecesInFenLine(raw) < minPieces) continue;

		let parsed: SourceLine;
		try {
			parsed = JSON.parse(raw);
		} catch {
			malformed++;
			continue;
		}
		if (!encodeRecord(parsed, scratch, 0)) continue;

		const bucket = scratch[0];
		scratch.copy(buffers[bucket], fill[bucket]);
		fill[bucket] += RECORD_SIZE;
		if (fill[bucket] >= FLUSH_BYTES) {
			writeSync(fds[bucket], buffers[bucket], 0, fill[bucket]);
			fill[bucket] = 0;
		}
	}

	for (let b = 0; b < BUCKETS; b++) {
		if (fill[b]) writeSync(fds[b], buffers[b], 0, fill[b]);
		closeSync(fds[b]);
	}
	return { linesRead, malformed };
}

function compareKeys(data: Buffer, a: number, b: number): number {
	for (let i = 0; i < KEY_SIZE; i++) {
		const diff = data[a + i] - data[b + i];
		if (diff) return diff;
	}
	return 0;
}

function sortAndMerge(bucketDir: string, outDir: string) {
	const out = openSync(join(outDir, 'evals.bin'), 'w');
	const index = new Uint32Array(INDEX_ENTRIES + 1);
	let written = 0;
	let duplicates = 0;
	let prefix = 0;

	for (let b = 0; b < BUCKETS; b++) {
		const data = readFileSync(join(bucketDir, `${b}.bin`));
		const offsets = Array.from({ length: data.length / RECORD_SIZE }, (_, i) => i * RECORD_SIZE);
		// Deeper first among equal keys, so the survivor of a duplicate is the deepest search.
		offsets.sort((x, y) => compareKeys(data, x, y) || data[y + KEY_SIZE] - data[x + KEY_SIZE]);

		const sorted = Buffer.allocUnsafe(data.length);
		let length = 0;
		for (let i = 0; i < offsets.length; i++) {
			if (i > 0 && compareKeys(data, offsets[i], offsets[i - 1]) === 0) {
				duplicates++;
				continue;
			}
			const recordPrefix = data.readUInt16BE(offsets[i]);
			while (prefix <= recordPrefix) index[prefix++] = written;
			data.copy(sorted, length, offsets[i], offsets[i] + RECORD_SIZE);
			length += RECORD_SIZE;
			written++;
		}
		writeSync(out, sorted, 0, length);
		rmSync(join(bucketDir, `${b}.bin`));
	}

	while (prefix <= INDEX_ENTRIES) index[prefix++] = written;
	closeSync(out);
	writeFileSync(join(outDir, 'index.bin'), Buffer.from(index.buffer));
	return { records: written, duplicates };
}

export async function build(source: string, outDir: string, minPieces = 26): Promise<Manifest> {
	const bucketDir = join(outDir, 'buckets');
	mkdirSync(bucketDir, { recursive: true });

	console.log(`eval-cache: pass 1 — scattering ${source} (min ${minPieces} pieces)`);
	const { linesRead, malformed } = await scatter(source, bucketDir, minPieces);
	console.log(`eval-cache: pass 2 — sorting ${BUCKETS} buckets (${malformed} malformed lines skipped)`);
	const { records, duplicates } = sortAndMerge(bucketDir, outDir);
	rmSync(bucketDir, { recursive: true });

	const manifest: Manifest = {
		source,
		sourceBytes: statSync(source).size,
		minPieces,
		linesRead,
		records,
		duplicates,
		builtAt: new Date().toISOString()
	};
	writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
	return manifest;
}

if (import.meta.main) {
	const { source, outDir, minPieces } = parseArgs(process.argv.slice(2));
	const started = Date.now();
	const manifest = await build(source, outDir, minPieces);
	console.log(
		`eval-cache: ${manifest.records.toLocaleString()} records from ${manifest.linesRead.toLocaleString()} lines ` +
			`(${manifest.duplicates} duplicates) in ${((Date.now() - started) / 60000).toFixed(1)} min`
	);
}
