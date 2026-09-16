import { Chess, type Square } from 'chess.js';
import type { Analysis, AnalysisLine, Engine, EngineScore } from '$lib/chess/engine';
import { Game, parseUci, toUci } from '$lib/chess/game.svelte';
import type { Arrow, SquareMarks } from '$lib/components/board';
import { isSound, lossFor, verdictFor, winChance, type Side, type Verdict } from './judge';
import { chooseReply } from './opponent';

export type AnalysisEngine = Pick<Engine, 'analyse'>;

export type FreePlayPhase =
	| 'thinking' // the engine is analysing or the computer is about to move
	| 'your-move'
	| 'retry' // the learner missed a planted mistake; one more try
	| 'reveal' // the punishing move is shown; the learner plays it
	| 'over'; // checkmate, stalemate or draw

export type Message = { tone: 'best' | 'good' | 'warn' | 'bad' | 'info'; text: string };

export type FreePlayOptions = {
	engine: AnalysisEngine;
	/** UCI moves from the initial position — usually where a drill line ended. */
	startMoves: string[];
	side: Side;
	mistakeRate?: number;
	multipv?: number;
	moveTimeMs?: number;
	opponentDelayMs?: number;
	random?: () => number;
	wait?: (ms: number) => Promise<void>;
};

// A planted mistake only counts as an opportunity if it hands the learner at least this much.
const OPPORTUNITY_MIN_GAIN = 0.15;

const defaultWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The evaluation of a finished game after `mover`'s move: mate for the mover, or level for a draw. */
export function scoreOfEnded(game: Pick<Game, 'status'>, mover: Side): EngineScore | null {
	if (game.status === 'checkmate') return { mate: mover === 'w' ? 1 : -1 };
	if (game.status === 'stalemate' || game.status === 'draw') return { cp: 0 };
	return null;
}

const san = (fen: string, uci: string) => {
	try {
		return new Chess(fen).move(parseUci(uci)).san;
	} catch {
		return uci;
	}
};

/**
 * Coached free play from any position: every learner move gets a verdict, the
 * computer answers with natural moves, and now and then deliberately errs so the
 * learner has something to punish. Missing the punishment means trying again.
 */
export class FreePlay {
	readonly game = new Game();
	readonly side: Side;

	phase = $state<FreePlayPhase>('thinking');
	message = $state<Message | null>(null);
	lastVerdict = $state<Verdict | null>(null);
	/** The computer's last move was a planted mistake worth punishing. */
	opportunity = $state<{ move: string; san: string } | null>(null);
	flash = $state<{ from: Square; to: Square; kind: 'correct' | 'soft' | 'wrong' } | null>(null);
	/** Engine evaluation of the position on the board (White's point of view), for an eval bar. */
	evaluation = $state<EngineScore | null>(null);

	readonly arrows = $derived.by<Arrow[]>(() => {
		if (this.phase !== 'reveal' || !this.#before?.lines[0]) return [];
		const { from, to } = parseUci(this.#before.lines[0].move);
		return [{ from, to, kind: 'hint' }];
	});

	readonly marks = $derived.by<SquareMarks>(() => {
		const marks: SquareMarks = {};
		const add = (square: Square, mark: NonNullable<SquareMarks[Square]>[number]) => {
			marks[square] = [...(marks[square] ?? []), mark];
		};
		const last = this.game.lastMove;
		if (last) {
			add(last.from, 'last-move');
			add(last.to, 'last-move');
		}
		if (this.game.checkSquare) add(this.game.checkSquare, 'check');
		if (this.flash) {
			add(this.flash.from, this.flash.kind);
			add(this.flash.to, this.flash.kind);
		}
		return marks;
	});

	#options: FreePlayOptions;
	/** Analysis of the current position when it is the learner's move. */
	#before: Analysis | null = null;
	#misses = 0;

	constructor(options: FreePlayOptions) {
		this.#options = options;
		this.side = options.side;
	}

	#analyse(fen: string) {
		return this.#options.engine.analyse(fen, {
			multipv: this.#options.multipv ?? 6,
			moveTimeMs: this.#options.moveTimeMs ?? 700
		});
	}

	async start() {
		this.game.load(this.#options.startMoves);
		if (this.#checkOver()) return;
		if (this.game.turn === this.side) await this.#prepareLearnerTurn();
		else await this.#computerMove(await this.#analyse(this.game.fen));
	}

	async submit(from: Square, to: Square, promotion?: string): Promise<Verdict | null> {
		if (!['your-move', 'retry', 'reveal'].includes(this.phase) || !this.#before) return null;
		const before = this.#before;
		const best = before.lines[0];
		const move = this.game.find({ from, to, promotion });
		if (!move || !best) return null;

		const uci = toUci(move);
		if (this.phase === 'reveal' && uci !== best.move) {
			this.message = { tone: 'info', text: `Play ${san(before.fen, best.move)} — the arrow shows it.` };
			return null;
		}

		this.phase = 'thinking';
		this.game.move({ from, to, promotion });
		const after = await this.#analyse(this.game.fen);
		if (after.lines[0]) this.evaluation = after.lines[0].score;
		else this.evaluation = scoreOfEnded(this.game, this.side) ?? this.evaluation;
		const playedScore = this.#scoreAfter(after, uci, before);
		const loss = lossFor(best, playedScore, this.side);
		// "It was the engine's first choice" cannot excuse a move that drew the game: the engine was given
		// the position without its history and did not know this move repeated. Let the loss decide.
		const drawn = this.game.status === 'stalemate' || this.game.status === 'draw';
		const verdict = verdictFor(loss, uci === best.move && !drawn);
		this.lastVerdict = verdict;

		if (this.opportunity && !isSound(verdict)) {
			this.game.undo();
			// The move was taken back, so the bar goes back to the position it came from.
			if (best) this.evaluation = best.score;
			this.#misses++;
			const punish = san(before.fen, best.move);
			if (this.#misses >= 2) {
				this.phase = 'reveal';
				this.flash = { from, to, kind: 'wrong' };
				this.message = { tone: 'bad', text: `${punish} punishes ${this.opportunity.san}. Play it.` };
			} else {
				this.phase = 'retry';
				this.flash = { from, to, kind: 'wrong' };
				this.message = {
					tone: 'bad',
					text: `You missed an opportunity: ${this.opportunity.san} can be punished. Try again.`
				};
			}
			return verdict;
		}

		this.flash = { from, to, kind: isSound(verdict) ? 'correct' : verdict === 'inaccuracy' ? 'soft' : 'wrong' };
		this.message = this.#describe(verdict, before, best);
		this.opportunity = null;
		this.#misses = 0;

		if (this.#checkOver()) return verdict;
		await this.#computerMove(after);
		return verdict;
	}

	/** The learner's move's score: its own line if the pre-move analysis had it, otherwise the fresh analysis. */
	#scoreAfter(after: Analysis, uci: string, before: Analysis): EngineScore {
		// The result first: Stockfish is given a position and not a history, so a move that draws by
		// repetition or by the fifty-move rule still carries the winning score in the pre-move analysis.
		const ended = scoreOfEnded(this.game, this.side);
		if (ended) return ended;
		const known = before.lines.find((l) => l.move === uci);
		if (known) return known.score;
		return after.lines[0]?.score ?? { cp: 0 };
	}

	#describe(verdict: Verdict, before: Analysis, best: AnalysisLine): Message {
		const better = san(before.fen, best.move);
		const wasOpportunity = this.opportunity;
		switch (verdict) {
			case 'best':
				return { tone: 'best', text: wasOpportunity ? `Punished! ${wasOpportunity.san} was a mistake.` : 'Best move.' };
			case 'good':
				return { tone: 'good', text: wasOpportunity ? `Good — you took advantage of ${wasOpportunity.san}.` : 'Good move.' };
			// Plain words for a newcomer; the exact numbers live in the evaluation bar.
			case 'inaccuracy':
				return { tone: 'warn', text: `Slightly inaccurate — ${better} was better.` };
			case 'mistake':
				return { tone: 'bad', text: `A mistake — it gives your opponent real chances. ${better} was better.` };
			case 'blunder':
				return { tone: 'bad', text: `A blunder — that can lose the game. ${better} was much better.` };
		}
	}

	async #computerMove(analysis: Analysis) {
		this.phase = 'thinking';
		const opponent: Side = this.side === 'w' ? 'b' : 'w';
		if (!analysis.lines.length) {
			this.#checkOver();
			return;
		}
		const choice = chooseReply(analysis.lines, opponent, {
			mistakeRate: this.#options.mistakeRate ?? 0.15,
			random: this.#options.random ?? Math.random
		});
		await (this.#options.wait ?? defaultWait)(this.#options.opponentDelayMs ?? 400);

		const beforeFen = this.game.fen;
		const learnerChanceBefore = winChance(analysis.lines[0].score, this.side);
		this.game.move(parseUci(choice.line.move));
		if (this.#checkOver()) return;

		await this.#prepareLearnerTurn();
		// No analysis lines (e.g. a search cut too short) means no evidence of an opportunity.
		const bestNow = this.#before?.lines[0];
		const gain = bestNow ? winChance(bestNow.score, this.side) - learnerChanceBefore : 0;
		this.opportunity =
			choice.kind === 'mistake' && gain >= OPPORTUNITY_MIN_GAIN
				? { move: choice.line.move, san: san(beforeFen, choice.line.move) }
				: null;
		this.#misses = 0;
	}

	async #prepareLearnerTurn() {
		this.phase = 'thinking';
		this.#before = await this.#analyse(this.game.fen);
		if (this.#before.lines[0]) this.evaluation = this.#before.lines[0].score;
		this.phase = 'your-move';
	}

	#checkOver(): boolean {
		if (!this.game.isOver) return false;
		this.phase = 'over';
		const status = this.game.status;
		this.message = {
			tone: 'info',
			text:
				status === 'checkmate'
					? this.game.turn === this.side
						? 'Checkmate — the computer wins.'
						: 'Checkmate — you win.'
					: status === 'stalemate'
						? 'Stalemate.'
						: 'Draw.'
		};
		return true;
	}
}
