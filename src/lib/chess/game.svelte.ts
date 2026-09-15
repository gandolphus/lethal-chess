import { Chess, type Color, type Move, type Square } from 'chess.js';

export type GameStatus = 'playing' | 'checkmate' | 'stalemate' | 'draw';

export type MoveInput = { from: Square; to: Square; promotion?: string };

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** "e7e8q" → { from: 'e7', to: 'e8', promotion: 'q' } */
export function parseUci(uci: string): MoveInput {
	return {
		from: uci.slice(0, 2) as Square,
		to: uci.slice(2, 4) as Square,
		promotion: uci.length > 4 ? uci[4] : undefined
	};
}

export const toUci = (move: { from: string; to: string; promotion?: string }) =>
	`${move.from}${move.to}${move.promotion ?? ''}`;

/**
 * Reactive wrapper around chess.js. The chess.js instance is mutable and not
 * reactive, so every mutation funnels through #sync() which republishes the
 * derived state as runes.
 */
export class Game {
	#chess: Chess;

	fen = $state('');
	turn = $state<Color>('w');
	history = $state<string[]>([]);
	/** The same moves as `history`, in UCI form — for handing a position to another controller. */
	uciHistory = $state<string[]>([]);
	lastMove = $state<{ from: Square; to: Square } | null>(null);
	checkSquare = $state<Square | null>(null);
	status = $state<GameStatus>('playing');

	constructor(fen: string = START_FEN) {
		this.#chess = new Chess(fen);
		this.#sync();
	}

	get isOver() {
		return this.status !== 'playing';
	}

	#sync() {
		const chess = this.#chess;
		this.fen = chess.fen();
		this.turn = chess.turn();
		this.history = chess.history();
		const verbose = chess.history({ verbose: true });
		this.uciHistory = verbose.map(toUci);
		const last = verbose.at(-1);
		this.lastMove = last ? { from: last.from, to: last.to } : null;
		this.checkSquare = chess.inCheck() ? this.#kingSquare(chess.turn()) : null;
		this.status = chess.isCheckmate()
			? 'checkmate'
			: chess.isStalemate()
				? 'stalemate'
				: chess.isDraw()
					? 'draw'
					: 'playing';
	}

	#kingSquare(color: Color): Square | null {
		for (const row of this.#chess.board()) {
			for (const square of row) {
				if (square && square.type === 'k' && square.color === color) return square.square;
			}
		}
		return null;
	}

	legalTargets = (from: Square): Square[] =>
		this.#chess.moves({ square: from, verbose: true }).map((move) => move.to);

	needsPromotion = (from: Square, to: Square): boolean =>
		this.#chess
			.moves({ square: from, verbose: true })
			.some((move) => move.to === to && Boolean(move.promotion));

	/** The legal move matching the input, without playing it. */
	find({ from, to, promotion }: MoveInput): Move | null {
		return (
			this.#chess
				.moves({ square: from, verbose: true })
				.find((move) => move.to === to && (!move.promotion || move.promotion === (promotion ?? 'q'))) ?? null
		);
	}

	/** Plays the move; returns it, or null if illegal. Promotion defaults to a queen. */
	move(input: MoveInput): Move | null {
		if (!this.find(input)) return null;
		const move = this.#chess.move({ ...input, promotion: input.promotion ?? 'q' });
		this.#sync();
		return move;
	}

	undo(): Move | null {
		const move = this.#chess.undo();
		if (move) this.#sync();
		return move;
	}

	/**
	 * Replaces the game with `startFen` followed by `uciMoves`, so a drill can
	 * start mid-line and still have a real move history. Throws on an illegal
	 * move rather than silently stopping short.
	 */
	load(uciMoves: string[] = [], startFen: string = START_FEN) {
		const chess = new Chess(startFen);
		for (const uci of uciMoves) {
			const { from, to, promotion } = parseUci(uci);
			try {
				chess.move({ from, to, promotion });
			} catch {
				throw new Error(`Illegal move ${uci} at ${chess.fen()}`);
			}
		}
		this.#chess = chess;
		this.#sync();
	}

	reset() {
		this.load();
	}
}
