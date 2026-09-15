// Framework-agnostic Stockfish wrapper. Speaks UCI over a Web Worker and
// exposes a small promise-based surface. Nothing in here knows about Svelte,
// so the drill logic and any future analysis code can reuse it directly.

export const ENGINE_URL = '/engine/stockfish-18-lite-single.js';

export type Difficulty = {
	id: string;
	label: string;
	/** null = unrestricted strength */
	elo: number | null;
	moveTimeMs: number;
};

// Stockfish refuses UCI_Elo below 1320, so the floor is the engine's, not ours.
export const DIFFICULTIES: Difficulty[] = [
	{ id: 'beginner', label: 'Beginner', elo: 1320, moveTimeMs: 200 },
	{ id: 'casual', label: 'Casual', elo: 1600, moveTimeMs: 300 },
	{ id: 'club', label: 'Club', elo: 2000, moveTimeMs: 500 },
	{ id: 'strong', label: 'Strong', elo: 2400, moveTimeMs: 800 },
	{ id: 'max', label: 'Max', elo: null, moveTimeMs: 1500 }
];

/** Centipawns or mate, from White's point of view. */
export const ENGINE_DESTROYED = 'Engine destroyed';

/** Swallows the rejection an in-flight analysis gets when its page is left; anything else still surfaces. */
export const ignoreDestroyed = (error: unknown) => {
	if ((error as Error | undefined)?.message !== ENGINE_DESTROYED) throw error;
};

export type EngineScore = { cp: number } | { mate: number };

export type AnalysisLine = { move: string; score: EngineScore; pv: string[]; depth: number };

export type Analysis = { fen: string; lines: AnalysisLine[] };

/**
 * Parses a UCI `info` line carrying a principal variation. UCI scores are from the
 * side to move's point of view; they are converted to White's. Bound-only scores
 * (`lowerbound`/`upperbound`) are skipped — they are not the engine's evaluation.
 */
export function parseInfo(line: string, whiteToMove: boolean): { rank: number; line: AnalysisLine } | null {
	const tokens = line.split(' ');
	if (tokens.includes('lowerbound') || tokens.includes('upperbound')) return null;
	const pvAt = tokens.indexOf('pv');
	const scoreAt = tokens.indexOf('score');
	if (pvAt < 0 || scoreAt < 0 || pvAt === tokens.length - 1) return null;

	const value = Number(tokens[scoreAt + 2]);
	const sign = whiteToMove ? 1 : -1;
	const score: EngineScore = tokens[scoreAt + 1] === 'mate' ? { mate: sign * value } : { cp: sign * value };
	const multipvAt = tokens.indexOf('multipv');
	const pv = tokens.slice(pvAt + 1);
	return {
		rank: multipvAt >= 0 ? Number(tokens[multipvAt + 1]) : 1,
		line: { move: pv[0], score, pv, depth: Number(tokens[tokens.indexOf('depth') + 1]) }
	};
}

/**
 * Assembles multi-PV output into one consistent candidate list. Stockfish reports
 * every PV again at each depth, and moves change rank between depths; a search cut
 * off by movetime mid-depth leaves some ranks from the new depth and some from the
 * previous one — which can list the same move twice. So lines are kept per depth,
 * and the result is the deepest depth that reported a complete set.
 */
export class MultiPvCollector {
	#byDepth = new Map<number, Map<number, AnalysisLine>>();

	add(rank: number, line: AnalysisLine) {
		const ranks = this.#byDepth.get(line.depth) ?? new Map<number, AnalysisLine>();
		ranks.set(rank, line);
		this.#byDepth.set(line.depth, ranks);
	}

	result(): AnalysisLine[] {
		const depths = [...this.#byDepth.keys()].sort((a, b) => b - a);
		if (!depths.length) return [];
		// Positions with few legal moves report fewer PVs than requested, so "complete" means as many as any depth had.
		const widest = Math.max(...[...this.#byDepth.values()].map((ranks) => ranks.size));
		const depth = depths.find((d) => this.#byDepth.get(d)!.size === widest) ?? depths[0];
		const seen = new Set<string>();
		return [...this.#byDepth.get(depth)!.entries()]
			.sort((a, b) => a[0] - b[0])
			.map(([, line]) => line)
			.filter((line) => !seen.has(line.move) && seen.add(line.move));
	}
}

type Waiter = {
	matches: (line: string) => boolean;
	resolve: (line: string) => void;
	reject: (error: Error) => void;
};

export class Engine {
	#worker: Worker;
	#waiters: Waiter[] = [];
	#booted: Promise<void>;
	// The worker queues `go`/`setoption` behind a running search but executes
	// `position`/`isready` immediately, so interleaved commands would corrupt a
	// search. Every state-touching operation runs through this serial lock.
	#lock: Promise<unknown> = Promise.resolve();
	#searching = false;
	#destroyed = false;
	#difficulty: Difficulty | null = null;

	constructor(url: string = ENGINE_URL) {
		this.#worker = new Worker(url);
		this.#worker.onmessage = (event) => {
			const line =
				typeof event.data === 'string' ? event.data : String(event.data?.data ?? '');
			this.#dispatch(line);
		};
		this.#booted = new Promise((resolve, reject) => {
			this.#worker.onerror = (event) => {
				const error = new Error(`Engine failed to load: ${event.message || 'worker error'}`);
				reject(error);
				this.#rejectAll(error);
			};
			this.#handshake().then(resolve, reject);
		});
	}

	#dispatch(line: string) {
		const index = this.#waiters.findIndex((waiter) => waiter.matches(line));
		if (index === -1) return;
		const [waiter] = this.#waiters.splice(index, 1);
		waiter.resolve(line);
	}

	#rejectAll(error: Error) {
		const waiters = this.#waiters;
		this.#waiters = [];
		for (const waiter of waiters) waiter.reject(error);
	}

	#send(command: string) {
		// A terminated worker never answers: fail now rather than wait forever.
		if (this.#destroyed) throw new Error(ENGINE_DESTROYED);
		this.#worker.postMessage(command);
	}

	#await(matches: (line: string) => boolean): Promise<string> {
		return new Promise((resolve, reject) => {
			if (this.#destroyed) reject(new Error(ENGINE_DESTROYED));
			else this.#waiters.push({ matches, resolve, reject });
		});
	}

	async #handshake() {
		this.#send('uci');
		await this.#await((l) => l.startsWith('uciok'));
		this.#send('isready');
		await this.#await((l) => l.startsWith('readyok'));
	}

	#exclusive<T>(operation: () => Promise<T>): Promise<T> {
		const run = this.#lock.then(() => this.#booted).then(operation);
		this.#lock = run.catch(() => {});
		return run;
	}

	async #sync() {
		this.#send('isready');
		await this.#await((l) => l.startsWith('readyok'));
	}

	get ready() {
		return this.#booted;
	}

	configure(difficulty: Difficulty) {
		return this.#exclusive(async () => {
			this.#difficulty = difficulty;
			this.#applyStrength(difficulty);
			await this.#sync();
		});
	}

	#applyStrength(difficulty: Difficulty | null) {
		if (difficulty?.elo == null) {
			this.#send('setoption name UCI_LimitStrength value false');
		} else {
			this.#send('setoption name UCI_LimitStrength value true');
			this.#send(`setoption name UCI_Elo value ${difficulty.elo}`);
		}
	}

	/**
	 * Full-strength multi-PV analysis: the engine's top `multipv` moves with scores
	 * (White's point of view) and principal variations. Temporarily lifts any
	 * strength limit set by configure(), and restores it afterwards.
	 */
	analyse(fen: string, { multipv = 5, moveTimeMs = 700 } = {}): Promise<Analysis> {
		return this.#exclusive(async () => {
			this.#applyStrength(null);
			this.#send(`setoption name MultiPV value ${multipv}`);
			await this.#sync();

			const collector = new MultiPvCollector();
			const whiteToMove = fen.split(' ')[1] !== 'b';
			this.#send(`position fen ${fen}`);
			this.#send(`go movetime ${moveTimeMs}`);
			this.#searching = true;
			try {
				await this.#await((line) => {
					if (line.startsWith('info ')) {
						const parsed = parseInfo(line, whiteToMove);
						if (parsed) collector.add(parsed.rank, parsed.line);
					}
					return line.startsWith('bestmove');
				});
			} finally {
				this.#searching = false;
			}

			this.#send('setoption name MultiPV value 1');
			this.#applyStrength(this.#difficulty);
			await this.#sync();
			return { fen, lines: collector.result() };
		});
	}

	newGame() {
		this.stop();
		return this.#exclusive(async () => {
			this.#send('ucinewgame');
			await this.#sync();
		});
	}

	/**
	 * Best move in UCI long algebraic form, e.g. "e2e4" / "e7e8q". The result is
	 * tagged with the FEN it was computed for, so callers can discard it if the
	 * position changed while the engine was thinking.
	 */
	bestMove(fen: string, moveTimeMs: number): Promise<{ fen: string; move: string | null }> {
		return this.#exclusive(async () => {
			this.#send(`position fen ${fen}`);
			this.#send(`go movetime ${moveTimeMs}`);
			this.#searching = true;
			try {
				const move = (await this.#await((l) => l.startsWith('bestmove'))).split(/\s+/)[1];
				return { fen, move: !move || move === '(none)' ? null : move };
			} finally {
				this.#searching = false;
			}
		});
	}

	/** Cuts the current search short; its bestMove() still resolves, early. */
	stop() {
		if (this.#searching) this.#send('stop');
	}

	destroy() {
		this.#destroyed = true;
		this.#worker.terminate();
		this.#rejectAll(new Error(ENGINE_DESTROYED));
	}
}
