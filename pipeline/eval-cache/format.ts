// On-disk format of the eval cache. Temporary build artefact — see
// lethal-chess-vault/Concepts/Data sources.md.
//
//   evals.bin   fixed 64-byte records sorted by key
//   index.bin   65,537 × uint32 LE: first record number for each 16-bit key prefix
//   manifest.json
//
// Record layout:
//   0..7    key        first 8 bytes of SHA-1(EPD)
//   8       depth      uint8 (clamped to 255)
//   9       pvCount    uint8, 0..MAX_PVS
//   10..29  pvs        MAX_PVS × (move uint16 LE, score int16 LE)
//   30..63  line       continuation of pv 0 after its first move, uint16 LE, 0-terminated
//
// Keys are 64-bit hashes, not EPDs: at ~180M positions the chance of any collision
// at all is ~0.1%, and storing EPDs would roughly double the cache.

import { hash } from 'node:crypto';

export const RECORD_SIZE = 64;
export const KEY_SIZE = 8;
export const MAX_PVS = 5;
export const LINE_MOVES = 17;
export const INDEX_ENTRIES = 65536;

export const keyOf = (epd: string): Buffer => hash('sha1', epd, 'buffer').subarray(0, KEY_SIZE);

export type EvalLine = { move: string; score: import('../lib/codec.ts').Score };

export type EvalRecord = {
	depth: number;
	/** Candidate moves from one multi-PV search, best first. */
	pvs: EvalLine[];
	/** Principal variation: pvs[0].move followed by this continuation. */
	line: string[];
};

export type Manifest = {
	source: string;
	sourceBytes: number;
	minPieces: number;
	linesRead: number;
	records: number;
	duplicates: number;
	builtAt: string;
};
