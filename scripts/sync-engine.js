#!/usr/bin/env node
// Copies the Stockfish lite/single-threaded build out of node_modules into
// static/engine so it can be served as a plain static asset and loaded in a
// Worker. The single-threaded build is deliberate: the multi-threaded one
// needs cross-origin isolation (COOP/COEP) headers to use SharedArrayBuffer.

import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', 'stockfish', 'bin');
const to = join(root, 'static', 'engine');

const files = ['stockfish-18-lite-single.js', 'stockfish-18-lite-single.wasm'];

mkdirSync(to, { recursive: true });
for (const file of files) {
	copyFileSync(join(from, file), join(to, file));
	console.log(`engine: ${file}`);
}
