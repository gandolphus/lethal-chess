// Regression tests for the engine's command serialisation (Fable code audit #1, #3).
// The mock reproduces the real stockfish worker's semantics, read from its
// minified source: `go` and `setoption` are queued while a search runs;
// everything else (position, isready, ucinewgame, stop) executes immediately.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DIFFICULTIES, Engine } from './engine';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

let sent: string[];
let positionsDuringSearch: number;

class MockWorker {
	onmessage: ((event: { data: string }) => void) | null = null;
	onerror: ((event: { message: string }) => void) | null = null;
	#queue: string[] = [];
	#search: { fen: string; timer: ReturnType<typeof setTimeout> } | null = null;
	#fen = START;

	postMessage(command: string) {
		sent.push(command);
		if (command.startsWith('go') || command.startsWith('setoption')) this.#queue.push(command);
		else this.#exec(command);
		this.#drain();
	}

	terminate() {}

	#emit(line: string) {
		setTimeout(() => this.onmessage?.({ data: line }), 0);
	}

	#exec(command: string) {
		if (command === 'uci') this.#emit('uciok');
		else if (command === 'isready') this.#emit('readyok');
		else if (command.startsWith('position fen ')) {
			if (this.#search) positionsDuringSearch++;
			this.#fen = command.slice('position fen '.length);
		} else if (command === 'stop') this.#finish();
		else if (command.startsWith('go movetime ')) {
			const fen = this.#fen;
			this.#search = { fen, timer: setTimeout(() => this.#finish(), Number(command.split(' ')[2])) };
		}
	}

	#finish() {
		if (!this.#search) return;
		clearTimeout(this.#search.timer);
		// The reply encodes which position was searched, so tests can tell.
		const move = this.#search.fen === START ? 'e2e4' : 'g1f3';
		this.#search = null;
		this.#emit(`bestmove ${move}`);
		this.#drain();
	}

	#drain() {
		while (this.#queue.length && !this.#search) this.#exec(this.#queue.shift()!);
	}
}

beforeEach(() => {
	sent = [];
	positionsDuringSearch = 0;
	(globalThis as { Worker?: unknown }).Worker = MockWorker;
});

afterEach(() => {
	delete (globalThis as { Worker?: unknown }).Worker;
});

describe('Engine', () => {
	it('tags each result with the position it was computed for', async () => {
		const engine = new Engine();
		expect(await engine.bestMove(AFTER_E4_E5, 10)).toEqual({ fen: AFTER_E4_E5, move: 'g1f3' });
	});

	it('never sends a position into a running search, and newGame cuts the search short', async () => {
		const engine = new Engine();
		await engine.ready;

		const started = Date.now();
		const stale = engine.bestMove(AFTER_E4_E5, 5000);
		await new Promise((resolve) => setTimeout(resolve, 20));
		const reset = engine.newGame();
		const configure = engine.configure(DIFFICULTIES[0]);
		const fresh = engine.bestMove(START, 20);

		const [staleResult, , , freshResult] = await Promise.all([stale, reset, configure, fresh]);

		expect(staleResult).toEqual({ fen: AFTER_E4_E5, move: 'g1f3' });
		expect(freshResult).toEqual({ fen: START, move: 'e2e4' });
		expect(positionsDuringSearch).toBe(0);
		expect(Date.now() - started).toBeLessThan(1000);

		const order = sent.filter((c) => /^(position|go|stop|ucinewgame|setoption)/.test(c));
		expect(order.indexOf('ucinewgame')).toBeGreaterThan(order.indexOf('stop'));
		expect(order.findIndex((c) => c.startsWith('setoption'))).toBeGreaterThan(order.indexOf('ucinewgame'));
		expect(order.lastIndexOf(`position fen ${START}`)).toBeGreaterThan(
			order.findIndex((c) => c.startsWith('setoption'))
		);
	});

	it('rejects a pending search on destroy instead of hanging', async () => {
		const engine = new Engine();
		await engine.ready;
		const pending = engine.bestMove(START, 5000);
		await new Promise((resolve) => setTimeout(resolve, 20));
		engine.destroy();
		await expect(pending).rejects.toThrow('Engine destroyed');
	});

	it('rejects ready when the worker fails to load', async () => {
		class BrokenWorker extends MockWorker {
			postMessage() {
				setTimeout(() => this.onerror?.({ message: '404' }), 0);
			}
		}
		(globalThis as { Worker?: unknown }).Worker = BrokenWorker;
		await expect(new Engine().ready).rejects.toThrow('Engine failed to load: 404');
	});
});
