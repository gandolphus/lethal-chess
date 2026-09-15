import type { Square } from 'chess.js';
import { Game, parseUci, toUci } from '$lib/chess/game.svelte';
import type { Arrow, SquareMarks } from '$lib/components/board';
import type { Bundle, BundleNode, Candidate, Reply } from './bundle';
import { gradeMove, type Grade } from './grade';
import { isDue, ratingFor, review, type CardState } from './scheduler';
import { cardsBelow, childEpd, isLearnerNode, toEpd } from './tree';

export type Mode = 'learn' | 'practice';

export type Phase =
	| 'opponent' // the opponent is about to move
	| 'await' // learner to move, first try
	| 'retry' // learner failed once; one more unhinted try
	| 'reveal' // the move is shown; learner must play it
	| 'done'; // the line has ended

export type Attempt = {
	bundleId: string;
	epd: string;
	mode: Mode;
	played: string;
	expected: string;
	grade: Grade['kind'];
	costCp: number | null;
	/** 1 for the first try at this position in this walk. */
	attemptNo: number;
	responseMs: number;
	at: string;
};

export type SessionOptions = {
	bundle: Bundle;
	mode: Mode;
	cards?: Map<string, CardState>;
	/**
	 * A first-ever walk: the opponent plays the most likely reply at every turn, so a newcomer
	 * meets the main line before any sideline. Later walks sample replies as usual.
	 */
	guided?: boolean;
	onAttempt?: (attempt: Attempt) => void;
	onReview?: (epd: string, state: CardState) => void;
	/** Pause before the opponent moves, so the learner can see it happen. */
	opponentDelayMs?: number;
	now?: () => Date;
	random?: () => number;
	wait?: (ms: number) => Promise<void>;
};

const defaultWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * One walk through a repertoire: from the root, the opponent plays weighted
 * replies (steered toward branches with due cards) and the learner answers
 * until the line runs out. Learn mode shows every move; practice mode grades
 * and schedules.
 */
export class DrillSession {
	readonly game = new Game();
	readonly bundle: Bundle;
	readonly mode: Mode;

	phase = $state<Phase>('opponent');
	lastGrade = $state<Grade | null>(null);
	/** SAN of the learner's last move — known even when the engine's candidates didn't include it. */
	lastPlayedSan = $state<string | null>(null);
	/** The move whose squares carry the current feedback flash. */
	flash = $state<{ from: Square; to: Square; kind: 'correct' | 'soft' | 'wrong' } | null>(null);
	name = $state<string | null>(null);
	movesPlayed = $state(0);

	readonly node = $derived.by<BundleNode | undefined>(() => this.bundle.nodes[toEpd(this.game.fen)]);

	readonly arrows = $derived.by<Arrow[]>(() => {
		const node = this.node;
		if (!isLearnerNode(node)) return [];
		const show = this.phase === 'reveal' || (this.mode === 'learn' && this.phase === 'await');
		if (!show) return [];
		const { from, to } = parseUci(node.move.uci);
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

	#cards: Map<string, CardState>;
	#below: Map<string, Set<string>>;
	#options: SessionOptions;
	#firstGrade: Grade | null = null;
	#attemptNo = 0;
	#awaitingSince = 0;

	constructor(options: SessionOptions) {
		this.bundle = options.bundle;
		this.mode = options.mode;
		this.#options = options;
		this.#cards = options.cards ?? new Map();
		this.#below = cardsBelow(options.bundle);
	}

	get #now() {
		return this.#options.now?.() ?? new Date();
	}

	/** Loads the root and plays until the learner is on move (or the line ends). */
	start(): Promise<void> {
		this.game.load(this.bundle.rootMoves);
		this.#updateName();
		return this.#advance();
	}

	/** The learner's move. Resolves once any consequent opponent move has been played. */
	async submit(from: Square, to: Square, promotion?: string): Promise<Grade | null> {
		const node = this.node;
		if (!isLearnerNode(node) || !['await', 'retry', 'reveal'].includes(this.phase)) return null;
		const legal = this.game.find({ from, to, promotion });
		if (!legal) return null;

		const uci = toUci(legal);
		const grade = gradeMove(node, uci, this.bundle.tolerances.soundCp);
		this.lastPlayedSan = legal.san;
		this.#attemptNo++;
		this.#firstGrade ??= grade;
		this.lastGrade = grade;
		this.#record(node, uci, grade);

		if (grade.kind === 'pass') {
			this.flash = { from, to, kind: this.phase === 'await' ? 'correct' : 'soft' };
			this.#schedule(node.epd);
			this.game.move(parseUci(uci));
			this.movesPlayed++;
			await this.#advance();
			return grade;
		}

		this.flash = { from, to, kind: grade.kind === 'soft' ? 'soft' : 'wrong' };
		// Each attempt's response time runs from the previous attempt, not from when the card first appeared.
		this.#awaitingSince = this.#now.getTime();
		// Learn mode and soft answers go straight to the reveal; a first real failure gets one retry.
		this.phase = this.mode === 'practice' && grade.kind === 'fail' && this.phase === 'await' ? 'retry' : 'reveal';
		return grade;
	}

	async #advance(): Promise<void> {
		for (;;) {
			this.#updateName();
			const node = this.node;
			if (isLearnerNode(node)) {
				this.phase = 'await';
				this.#firstGrade = null;
				this.#attemptNo = 0;
				this.#awaitingSince = this.#now.getTime();
				return;
			}
			if (!node?.replies?.length) {
				this.phase = 'done';
				return;
			}
			this.phase = 'opponent';
			const reply = this.#chooseReply(node);
			await (this.#options.wait ?? defaultWait)(this.#options.opponentDelayMs ?? 450);
			this.game.move(parseUci(reply.uci));
			this.movesPlayed++;
		}
	}

	#chooseReply(node: BundleNode): Reply {
		const replies = node.replies!;
		if (this.#options.guided) return replies.reduce((best, r) => (r.weight > best.weight ? r : best));
		const now = this.#now;
		// Weight by how likely the reply is, boosted by how much of the branch needs practice.
		const scored = replies.map((reply) => {
			const cards = [...(this.#below.get(childEpd(node.epd, reply.uci)) ?? [])];
			const due = cards.length ? cards.filter((epd) => isDue(this.#cards.get(epd), now)).length / cards.length : 0;
			return { reply, score: reply.weight * (0.25 + due) };
		});
		const total = scored.reduce((sum, s) => sum + s.score, 0);
		let pick = (this.#options.random ?? Math.random)() * total;
		for (const s of scored) {
			pick -= s.score;
			if (pick <= 0) return s.reply;
		}
		return scored.at(-1)!.reply;
	}

	#record(node: BundleNode & { move: Candidate }, played: string, grade: Grade) {
		this.#options.onAttempt?.({
			bundleId: this.bundle.id,
			epd: node.epd,
			mode: this.mode,
			played,
			expected: node.move.uci,
			grade: grade.kind,
			costCp: grade.kind === 'pass' ? 0 : grade.costCp,
			attemptNo: this.#attemptNo,
			responseMs: this.#now.getTime() - this.#awaitingSince,
			at: this.#now.toISOString()
		});
	}

	#schedule(epd: string) {
		if (this.mode !== 'practice' || !this.#firstGrade) return;
		const state = review(this.#cards.get(epd), ratingFor(this.#firstGrade), this.#now);
		this.#cards.set(epd, state);
		this.#options.onReview?.(epd, state);
	}

	#updateName() {
		const name = this.node?.name;
		if (name) this.name = name;
	}
}
