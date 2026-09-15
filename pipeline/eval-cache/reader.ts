// Read side of the eval cache: 16-bit prefix index → binary search in a small range.

import { closeSync, openSync, readFileSync, readSync } from 'node:fs';
import { join } from 'node:path';
import { NO_MOVE, decodeMove, decodeScore } from '../lib/codec.ts';
import { INDEX_ENTRIES, KEY_SIZE, LINE_MOVES, RECORD_SIZE, keyOf, type EvalRecord, type Manifest } from './format.ts';

export class EvalCache {
	readonly manifest: Manifest;
	#fd: number;
	#index: Uint32Array;

	constructor(dir: string) {
		this.manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
		const raw = readFileSync(join(dir, 'index.bin'));
		this.#index = new Uint32Array(raw.buffer, raw.byteOffset, INDEX_ENTRIES + 1);
		this.#fd = openSync(join(dir, 'evals.bin'), 'r');
	}

	get size() {
		return this.manifest.records;
	}

	get(epd: string): EvalRecord | null {
		const key = keyOf(epd);
		const prefix = key.readUInt16BE(0);
		const first = this.#index[prefix];
		const count = this.#index[prefix + 1] - first;
		if (!count) return null;

		const block = Buffer.allocUnsafe(count * RECORD_SIZE);
		readSync(this.#fd, block, 0, block.length, first * RECORD_SIZE);

		let low = 0;
		let high = count - 1;
		while (low <= high) {
			const mid = (low + high) >> 1;
			const cmp = key.compare(block, mid * RECORD_SIZE, mid * RECORD_SIZE + KEY_SIZE);
			if (cmp === 0) return decode(block, mid * RECORD_SIZE);
			if (cmp > 0) low = mid + 1;
			else high = mid - 1;
		}
		return null;
	}

	close() {
		closeSync(this.#fd);
	}
}

function decode(block: Buffer, offset: number): EvalRecord {
	const pvCount = block.readUInt8(offset + 9);
	const pvs = Array.from({ length: pvCount }, (_, i) => ({
		move: decodeMove(block.readUInt16LE(offset + 10 + i * 4)),
		score: decodeScore(block.readInt16LE(offset + 12 + i * 4))
	}));

	const line = pvs.length ? [pvs[0].move] : [];
	for (let i = 0; i < LINE_MOVES; i++) {
		const move = block.readUInt16LE(offset + 30 + i * 2);
		if (move === NO_MOVE) break;
		line.push(decodeMove(move));
	}
	return { depth: block.readUInt8(offset + KEY_SIZE), pvs, line };
}
