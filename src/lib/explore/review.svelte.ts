import { Chess, type Square } from 'chess.js';
import { Game, parseUci, toUci } from '$lib/chess/game.svelte';
import { winChance } from '$lib/coach/judge';
import type { Arrow, SquareMarks } from '$lib/components/board';
import type { Bundle } from '$lib/drill/bundle';
import type { CardState } from '$lib/drill/scheduler';
import { review, Rating } from '$lib/drill/scheduler';
import type { Attempt } from '$lib/drill/session.svelte';
import { toEpd } from '$lib/drill/tree';
import type { Book, IndexedLine } from './book';
import { learnerPlies, type LineReview, type ReviewRating } from './mastery';

export type ReviewPhase =
	| 'opponent' // the computer is about to play the line's next move
	| 'await' // learner to move, first try
	| 'retry' // one more unhinted try
	| 'reveal' // the move is shown; the learner plays it
	| 'done';

export type ReviewOptions = {
	bundle: Bundle;
	book: Book;
	line: IndexedLine;
	/** The line's current card, so the result can say when it comes back. */
	card?: CardState;
	onAttempt?: (attempt: Attempt) => void;
	onReview?: (review: LineReview) => void;
	opponentDelayMs?: number;
	now?: () => Date;
	random?: () => number;
	wait?: (ms: number) => Promise<void>;
};

// Another move this close to the book move in winning chances is sound: "right idea, other line".
const SOUND_LOSS = 0.06;

const defaultWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const sanOf = (fen: string, uci: string) => new Chess(fen).move(parseUci(uci)).san;

/**
 * Replays one discovered line from memory. The walk starts at a random point between the opening's
 * defining moves and the line's entrance, with the line's name hidden; the computer plays the other
 * side's moves of the line and the learner must reproduce theirs to the end. A sound move from another
 * line is "right idea, other line" (try again, rated Hard); a wrong move gets one unhinted retry, then
 * the move is shown (rated Again). The line is scheduled by its worst decision.
 */
export class ReviewSession {
	readonly game = new Game();
	readonly bundle: Bundle;
	readonly line: IndexedLine;

	phase = $state<ReviewPhase>('opponent');
	message = $state<{ tone: 'pass' | 'soft' | 'fail' | 'info'; text: string } | null>(null);
	flash = $state<{ from: Square; to: Square; kind: 'correct' | 'soft' | 'wrong' } | null>(null);
	hintLevel = $state(0);
	/** Set when the walk is done. */
	result = $state<{ rating: ReviewRating; due: Date } | null>(null);

	readonly arrows = $derived.by<Arrow[]>(() => {
		if (this.phase !== 'reveal') return [];
		const { from, to } = parseUci(this.expected!);
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
		if (this.hintLevel === 1 && this.expected && (this.phase === 'await' || this.phase === 'retry')) add(parseUci(this.expected).from, 'hint');
		return marks;
	});

	/** Half-moves of the line played so far, and its length: progress without naming it. */
	readonly progress = $derived.by(() => ({ played: this.game.uciHistory.length, total: this.line.moves.length }));

	#options: ReviewOptions;
	#worst: ReviewRating = 'good';
	#abandoned = false;
	#attemptNo = 0;
	#awaitingSince = 0;

	constructor(options: ReviewOptions) {
		this.#options = options;
		this.bundle = options.bundle;
		this.line = options.line;
	}

	get #now() {
		return this.#options.now?.() ?? new Date();
	}

	get expected(): string | null {
		return this.line.moves[this.game.uciHistory.length] ?? null;
	}

	/** Where the walk starts: somewhere from the end of the defining moves up to the entrance, never past the learner's last move. */
	startPly(): number {
		const opening = (this.bundle.openingMoves ?? []).length;
		const last = learnerPlies(this.line, opening, this.bundle.side).at(-1) ?? opening;
		const latest = Math.max(opening, Math.min(this.line.entry - 1, last));
		return opening + Math.floor((this.#options.random ?? Math.random)() * (latest - opening + 1));
	}

	/** Stops this replay for good; a pending computer move is discarded. */
	abandon() {
		this.#abandoned = true;
	}

	async start(): Promise<void> {
		this.game.load(this.line.moves.slice(0, this.startPly()));
		await this.#advance();
	}

	async submit(from: Square, to: Square, promotion?: string): Promise<boolean> {
		if (this.#abandoned || !['await', 'retry', 'reveal'].includes(this.phase) || !this.expected) return false;
		const legal = this.game.find({ from, to, promotion });
		if (!legal) return false;
		const uci = toUci(legal);
		const expected = this.expected;
		const fen = this.game.fen;
		this.#attemptNo++;

		if (uci === expected) {
			this.#record(fen, uci, 'pass');
			this.flash = { from, to, kind: this.phase === 'await' ? 'correct' : 'soft' };
			this.message = null;
			this.game.move(legal);
			await this.#advance();
			return true;
		}

		if (this.phase === 'reveal') {
			this.message = { tone: 'info', text: `Play ${sanOf(fen, expected)} — the arrow shows it.` };
			return false;
		}

		const san = legal.san;
		if (this.#isSound(fen, uci)) {
			this.#record(fen, uci, 'soft');
			this.#lower('hard');
			this.flash = { from, to, kind: 'soft' };
			this.message = { tone: 'soft', text: `${san} is good too, but this line goes another way. Try again.` };
			this.phase = 'retry';
			return false;
		}

		this.#record(fen, uci, 'fail');
		this.#lower('again');
		this.flash = { from, to, kind: 'wrong' };
		this.#awaitingSince = this.#now.getTime();
		if (this.phase === 'await') {
			this.message = { tone: 'fail', text: `Not ${san}. One more try, no hints.` };
			this.phase = 'retry';
		} else {
			this.message = { tone: 'fail', text: `This line plays ${sanOf(fen, expected)} — the arrow shows it.` };
			this.phase = 'reveal';
		}
		return false;
	}

	/** First the piece, then the move. Either makes the line harder to call remembered. */
	hint() {
		if (!['await', 'retry'].includes(this.phase)) return;
		this.hintLevel++;
		if (this.hintLevel === 1) this.#lower('hard');
		else {
			this.#lower('again');
			this.phase = 'reveal';
			this.message = { tone: 'info', text: `This line plays ${sanOf(this.game.fen, this.expected!)}.` };
		}
	}

	/**
	 * Whether a move off this line is nonetheless a good move. Being in the book is not enough on its own:
	 * a few catalogued lines take a move the coach calls a mistake, and Explore says so ("an established
	 * move, but a dubious one") where Practice used to call the same move "good too". The evaluation
	 * decides when there is one; the book is the fallback for a position the bundle has no node for.
	 */
	#isSound(fen: string, uci: string): boolean {
		const epd = toEpd(fen);
		const node = this.bundle.nodes[epd];
		const played = node?.candidates.find((c) => c.uci === uci);
		if (!node || !played) return this.#options.book.isBookMove(epd, uci);
		const mover = epd.split(' ')[1] as 'w' | 'b';
		return winChance(node.candidates[0].score, mover) - winChance(played.score, mover) <= SOUND_LOSS;
	}

	#lower(rating: ReviewRating) {
		const order: ReviewRating[] = ['good', 'hard', 'again'];
		if (order.indexOf(rating) > order.indexOf(this.#worst)) this.#worst = rating;
	}

	async #advance() {
		for (;;) {
			const ply = this.game.uciHistory.length;
			if (ply >= this.line.moves.length) {
				this.#finish();
				return;
			}
			if (this.game.turn === this.bundle.side) {
				this.phase = 'await';
				this.hintLevel = 0;
				this.#attemptNo = 0;
				this.#awaitingSince = this.#now.getTime();
				return;
			}
			this.phase = 'opponent';
			await (this.#options.wait ?? defaultWait)(this.#options.opponentDelayMs ?? 450);
			if (this.#abandoned) return;
			this.game.move(parseUci(this.line.moves[ply]));
		}
	}

	#finish() {
		const now = this.#now;
		const rating = this.#worst;
		const next = review(this.#options.card, { again: Rating.Again, hard: Rating.Hard, good: Rating.Good }[rating], now);
		this.result = { rating, due: next.due };
		this.phase = 'done';
		this.#options.onReview?.({ bundleId: this.bundle.id, line: this.line.key, rating, at: now.toISOString() });
	}

	#record(fen: string, played: string, grade: Attempt['grade']) {
		this.#options.onAttempt?.({
			bundleId: this.bundle.id,
			epd: toEpd(fen),
			mode: 'practice',
			played,
			expected: this.expected!,
			grade,
			costCp: null,
			attemptNo: this.#attemptNo,
			responseMs: Math.max(0, this.#now.getTime() - this.#awaitingSince),
			at: this.#now.toISOString()
		});
	}
}
