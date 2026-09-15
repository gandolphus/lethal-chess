import { Chess, type Square } from 'chess.js';
import type { Analysis, EngineScore } from '$lib/chess/engine';
import { Game, parseUci, toUci } from '$lib/chess/game.svelte';
import { scoreOfEnded, type AnalysisEngine, type Message } from '$lib/coach/freeplay.svelte';
import { isSound, lossFor, verdictFor, winChance, type Side, type Verdict } from '$lib/coach/judge';
import { chooseReply } from '$lib/coach/opponent';
import type { Arrow, SquareMarks } from '$lib/components/board';
import type { Bundle, BundleNode } from '$lib/drill/bundle';
import { toEpd } from '$lib/drill/tree';
import type { Book, Discovery, IndexedLine, LineStage } from './book';

export type ExplorePhase =
	| 'thinking' // analysing, or the computer is about to move
	| 'your-move'
	| 'decide' // the learner's move was a mistake: try again or play on
	| 'over'; // checkmate, stalemate, draw — or the engine could not load

/** Something the learner just found, for a celebration. Assisted discoveries are shown but not counted. */
/** Something found while exploring. `assisted`: reached through a shown move, not counted. `known`: discovered in an earlier game. */
export type DiscoveryEvent = {
	id: number;
	kind: LineStage;
	lines: IndexedLine[];
	assisted: boolean;
	known: boolean;
	/** Moves played when it happened. */
	ply: number;
};

/** The line the learner is inside: its entrance name and how far along the nearest unfinished end is. */
export type LineProgress = {
	name: string;
	/** Lines still open from here (undiscovered ones, or all of them once every one is discovered). */
	lines: number;
	allKnown: boolean;
	/** Half-moves from the entrance to the nearest end, and how many of them are played. */
	total: number;
	played: number;
};

export type ExploreOptions = {
	bundle: Bundle;
	book: Book;
	/** The learner's progress so far, per line key; updated as lines are found. */
	stages: Map<string, LineStage>;
	/** Loads the engine on first need; positions inside the book never need it. */
	engine: () => Promise<AnalysisEngine>;
	onDiscovery?: (discovery: Discovery) => void;
	mistakeRate?: number;
	moveTimeMs?: number;
	opponentDelayMs?: number;
	now?: () => Date;
	random?: () => number;
	wait?: (ms: number) => Promise<void>;
};

// The computer's move hands the learner an opportunity only if it gives at least this much.
const OPPORTUNITY_MIN_GAIN = 0.15;
// A mistake played this fast was played with confidence: the correction is worth more there, so it is
// asked for straight away rather than waiting for the learner to press Why?.
const CONFIDENT_MS = 4000;
// Undiscovered lines pull the computer's book replies; discovered ones keep a little weight.
const KNOWN_LINE_WEIGHT = 0.2;

const defaultWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const sanOf = (fen: string, uci: string) => {
	try {
		return new Chess(fen).move(parseUci(uci)).san;
	} catch {
		return uci;
	}
};

/** A principal variation in SAN, stopping at the first move that doesn't apply; at most 8 moves. */
const sanLine = (fen: string, pv: string[]) => {
	const chess = new Chess(fen);
	const line: string[] = [];
	for (const uci of pv.slice(0, 8)) {
		try {
			line.push(chess.move(parseUci(uci)).san);
		} catch {
			break;
		}
	}
	return line;
};

const fromNode = (fen: string, node: BundleNode): Analysis => ({
	fen,
	lines: node.candidates.map((c) => ({ move: c.uci, score: c.score, pv: [], depth: node.depth }))
});

/**
 * Exploration: the learner plays the opening's defining moves, then anything they like. Established
 * lines are secret; the session reports when the learner enters one and when they reach its end.
 * Good moves never interrupt play. A mistake off the book stops for a choice: try again or play on.
 * The computer answers from the book while the book lasts — steering toward lines the learner
 * hasn't found — and past it plays natural engine moves with the odd deliberate mistake.
 */
export class ExploreSession {
	readonly game = new Game();
	readonly bundle: Bundle;
	readonly side: Side;

	phase = $state<ExplorePhase>('thinking');
	message = $state<Message | null>(null);
	flash = $state<{ from: Square; to: Square; kind: 'correct' | 'soft' | 'wrong' } | null>(null);
	/** Evaluation of the position on the board, White's point of view. */
	evaluation = $state<EngineScore | null>(null);
	events = $state<DiscoveryEvent[]>([]);
	/** 0 no hint, 1 the piece to move, 2 the move itself. */
	hintLevel = $state(0);
	opportunity = $state<{ san: string } | null>(null);
	loadingEngine = $state(false);
	/**
	 * Why a mistake was a mistake, revealed on request: the opponent's reply that punishes it — or, when
	 * the learner missed a chance to punish the computer, the move they missed.
	 */
	explanation = $state<{
		kind: 'refutation' | 'missed';
		uci: string;
		san: string;
		line: string[];
		/** A refutation is first a question: the learner looks for it (one retry), then it is shown. */
		stage: 'find' | 'retry' | 'shown';
	} | null>(null);
	/** The engine's line is being played out on the board, to be taken back afterwards. */
	replaying = $state(false);

	readonly openingMoves: string[];

	/** Still inside the opening's defining moves. */
	readonly inOpening = $derived.by(() => this.game.uciHistory.length < this.openingMoves.length);

	/** The position is on at least one established line with somewhere left to go. */
	readonly inBook = $derived.by(() => this.#book.continuations(toEpd(this.game.fen)).length > 0);

	/** The deepest named position reached on the way here. */
	readonly name = $derived.by(() => {
		const chess = new Chess();
		let name = this.bundle.nodes[toEpd(chess.fen())]?.name ?? null;
		for (const uci of this.game.uciHistory) {
			chess.move(parseUci(uci));
			name = this.bundle.nodes[toEpd(chess.fen())]?.name ?? name;
		}
		return name;
	});

	/** An entered line the learner is following but hasn't finished, preferring one not yet discovered. */
	readonly following = $derived.by<IndexedLine | null>(() => {
		const open = this.#book
			.at(toEpd(this.game.fen))
			.filter(({ line, index }) => index >= line.entry && index < line.moves.length)
			.map(({ line }) => line);
		void this.#stageVersion;
		return open.find((line) => this.#stages.get(line.key) !== 'discovered') ?? open[0] ?? null;
	});

	/** Anticipation: set from a line's entrance until its end is reached. */
	readonly progress = $derived.by<LineProgress | null>(() => {
		void this.#stageVersion;
		const open = this.#book.at(toEpd(this.game.fen)).filter(({ line, index }) => index >= line.entry && index < line.moves.length);
		if (!open.length) return null;
		const unfound = open.filter(({ line }) => this.#stages.get(line.key) !== 'discovered');
		const pool = unfound.length ? unfound : open;
		const nearest = pool.reduce((a, b) => (b.line.moves.length - b.index < a.line.moves.length - a.index ? b : a));
		return {
			name: nearest.line.entryName ?? nearest.line.variation,
			lines: pool.length,
			allKnown: !unfound.length,
			total: nearest.line.moves.length - nearest.line.entry,
			played: nearest.index - nearest.line.entry
		};
	});

	readonly arrows = $derived.by<Arrow[]>(() => {
		if (this.phase === 'decide' && this.explanation?.stage === 'shown' && !this.replaying) {
			const { from, to } = parseUci(this.explanation.uci);
			return [{ from, to, kind: this.explanation.kind === 'refutation' ? 'refutation' : 'hint' }];
		}
		if (this.phase !== 'your-move' || this.hintLevel < 2 || !this.#hintMove) return [];
		const { from, to } = parseUci(this.#hintMove);
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
		if (this.phase === 'your-move' && this.hintLevel === 1 && this.#hintMove) add(parseUci(this.#hintMove).from, 'hint');
		return marks;
	});

	#options: ExploreOptions;
	#book: Book;
	#stages: Map<string, LineStage>;
	#stageVersion = $state(0);
	#engine: AnalysisEngine | null = null;
	/** Analysis of the position when it is the learner's move. */
	#before: Analysis | null = null;
	/** Analysis of the position after the learner's move, when the engine had to make one. */
	#after: Analysis | null = null;
	#hintMove = $state<string | null>(null);
	/** Positions where the learner was shown the move: lines through them don't count as found alone. */
	#shown = new Set<string>();
	#generation = 0;
	#eventId = 0;
	#thinkingSince = 0;

	constructor(options: ExploreOptions) {
		this.#options = options;
		this.bundle = options.bundle;
		this.side = options.bundle.side;
		this.openingMoves = options.bundle.openingMoves ?? options.bundle.rootMoves;
		this.#book = options.book;
		this.#stages = options.stages;
	}

	get #now() {
		return this.#options.now?.() ?? new Date();
	}

	get #wait() {
		return this.#options.wait ?? defaultWait;
	}

	/** A new game from the initial position. */
	async start(): Promise<void> {
		const generation = ++this.#generation;
		this.game.load([]);
		this.#reset();
		this.#shown.clear();
		this.events = [];
		this.evaluation = null;
		this.#visit();
		await this.#continue(generation);
	}

	async submit(from: Square, to: Square, promotion?: string): Promise<Verdict | null> {
		if (this.phase !== 'your-move') return null;
		const legal = this.game.find({ from, to, promotion });
		if (!legal) return null;
		const uci = toUci(legal);
		const epd = toEpd(this.game.fen);
		const generation = this.#generation;

		if (this.inOpening) {
			const expected = this.openingMoves[this.game.uciHistory.length];
			if (uci !== expected) {
				this.flash = { from, to, kind: 'wrong' };
				this.#hintMove = expected;
				this.hintLevel = 2;
				this.message = { tone: 'info', text: `The ${this.bundle.name} goes ${sanOf(this.game.fen, expected)} here — the arrow shows it.` };
				return null;
			}
			this.flash = { from, to, kind: 'correct' };
			this.message = null;
			this.game.move(legal);
			this.#visit();
			await this.#continue(generation);
			return 'best';
		}

		const before = this.#before;
		const best = before?.lines[0];
		if (!before || !best) return null;
		const wasInBook = this.inBook;
		const book = this.#book.isBookMove(epd, uci);

		this.phase = 'thinking';
		this.game.move(legal);
		const played = await this.#scoreOfMove(before, uci);
		if (generation !== this.#generation || (this.phase as ExplorePhase) === 'over') return null;
		const verdict = verdictFor(lossFor(best, played, this.side), uci === best.move);
		const better = sanOf(before.fen, best.move);

		const serious = verdict === 'mistake' || verdict === 'blunder';
		if (!book && (serious || (this.opportunity && !isSound(verdict)))) {
			this.flash = { from, to, kind: 'wrong' };
			this.message = this.opportunity
				? { tone: 'bad', text: `You missed an opportunity: ${this.opportunity.san} can be punished. Try again, or play on.` }
				: {
						tone: 'bad',
						text: `${verdict === 'blunder' ? 'A blunder — that can lose the game' : 'A mistake — it gives your opponent real chances'}. Try again, or play on.`
					};
			this.phase = 'decide';
			// Quick and wrong: ask for the refutation at once (hypercorrection), rather than waiting for Why?.
			if (this.#now.getTime() - this.#thinkingSince < CONFIDENT_MS && !this.opportunity) {
				const stopped = this.message.text;
				await this.explain();
				if (this.explanation?.stage === 'find') {
					const opponent = this.side === 'w' ? 'Black' : 'White';
					this.message = { tone: 'bad', text: `${stopped.split('.')[0]}, played quickly. Find ${opponent}'s reply that punishes it.` };
				}
			}
			return verdict;
		}

		this.flash = { from, to, kind: isSound(verdict) ? 'correct' : 'soft' };
		this.message = this.#describe(verdict, { book, wasInBook, better });
		this.opportunity = null;
		this.#visit();
		await this.#afterLearnerMove(generation);
		return verdict;
	}

	/** Takes back a mistake to look for a better move. */
	tryAgain() {
		if (this.phase !== 'decide' || this.replaying) return;
		this.game.undo();
		this.flash = null;
		this.explanation = null;
		this.#after = null;
		if (this.#before?.lines[0]) this.evaluation = this.#before.lines[0].score;
		this.message = { tone: 'info', text: 'Look again — what does the position need?' };
		this.phase = 'your-move';
	}

	/** Keeps a mistake on the board and lets the computer answer. */
	async playOn() {
		if (this.phase !== 'decide' || this.replaying) return;
		const generation = this.#generation;
		this.message = null;
		this.opportunity = null;
		this.explanation = null;
		this.#visit();
		await this.#afterLearnerMove(generation);
	}

	/** Reveals why the move on the board was a mistake. */
	async explain() {
		if (this.phase !== 'decide' || this.explanation) return;
		const generation = this.#generation;
		const before = this.#before;
		if (this.opportunity && before?.lines[0]) {
			// The explanation *is* the missed move, so it counts as shown for the lines through here.
			const best = before.lines[0].move;
			this.#shown.add(toEpd(before.fen));
			const line = this.bundle.nodes[toEpd(before.fen)]?.line ?? sanLine(before.fen, before.lines[0].pv);
			this.explanation = { kind: 'missed', uci: best, san: sanOf(before.fen, best), line: line.length ? line : [sanOf(before.fen, best)], stage: 'shown' };
			return;
		}
		const fen = this.game.fen;
		const node = this.bundle.nodes[toEpd(fen)];
		let uci: string | undefined;
		let line: string[] = [];
		if (node?.candidates[0]) {
			uci = node.candidates[0].uci;
			line = node.line;
		} else {
			const analysis = this.#after?.fen === fen ? this.#after : await this.#analyse(fen);
			if (generation !== this.#generation || this.phase !== 'decide') return;
			if (analysis?.fen === fen) this.#after = analysis;
			uci = analysis?.lines[0]?.move;
			line = analysis?.lines[0] ? sanLine(fen, analysis.lines[0].pv) : [];
		}
		if (!uci) return;
		this.explanation = { kind: 'refutation', uci, san: sanOf(fen, uci), line: line.length ? line : [sanOf(fen, uci)], stage: 'find' };
		const opponent = this.side === 'w' ? 'Black' : 'White';
		this.message = { tone: 'info', text: `Why is it a mistake? Play ${opponent}'s best reply.` };
	}

	/** The learner's answer to "find the reply that punishes it". Either way the engine's line then plays out. */
	async answerWhy(from: Square, to: Square, promotion?: string): Promise<boolean> {
		const explanation = this.explanation;
		if (this.phase !== 'decide' || this.replaying || !explanation || explanation.stage === 'shown') return false;
		const legal = this.game.find({ from, to, promotion });
		if (!legal) return false;
		if (toUci(legal) === explanation.uci) {
			this.flash = { from, to, kind: 'correct' };
			this.message = { tone: 'best', text: `Exactly — ${explanation.san} punishes it.` };
		} else if (explanation.stage === 'find') {
			this.flash = { from, to, kind: 'wrong' };
			this.explanation = { ...explanation, stage: 'retry' };
			this.message = { tone: 'bad', text: 'Not that. What does the mistake allow? One more try.' };
			return false;
		} else {
			this.message = { tone: 'bad', text: `${explanation.san} punishes it.` };
		}
		this.explanation = { ...explanation, stage: 'shown' };
		await this.#replayLine();
		return true;
	}

	/** Plays the first moves of the engine's line on the board, then takes them back. */
	async #replayLine() {
		const line = this.explanation?.line.slice(0, 5) ?? [];
		const generation = this.#generation;
		this.replaying = true;
		let played = 0;
		for (const san of line) {
			await this.#wait(650);
			if (generation !== this.#generation || this.phase !== 'decide') break;
			try {
				const move = new Chess(this.game.fen).move(san);
				this.game.move({ from: move.from, to: move.to, promotion: move.promotion });
				played++;
			} catch {
				break;
			}
		}
		await this.#wait(1100);
		if (generation === this.#generation) for (; played > 0; played--) this.game.undo();
		this.flash = null;
		this.replaying = false;
	}

	get canTakeBack() {
		return ['your-move', 'decide', 'over'].includes(this.phase) && this.#takeBackPlies() > 0;
	}

	/** Back to the learner's previous decision, past the computer's reply. */
	async takeBack() {
		if (!this.canTakeBack) return;
		const generation = ++this.#generation;
		for (let plies = this.#takeBackPlies(); plies > 0; plies--) this.game.undo();
		this.#reset();
		await this.#continue(generation);
	}

	/** First the piece, then the move. Showing the move means lines through here aren't found alone. */
	hint() {
		if (this.phase !== 'your-move' || this.hintLevel >= 2) return;
		this.#hintMove ??= this.#suggest();
		if (!this.#hintMove) return;
		this.hintLevel++;
		if (this.hintLevel === 2 && !this.inOpening) this.#shown.add(toEpd(this.game.fen));
	}

	#takeBackPlies() {
		const history = this.game.uciHistory.length;
		// Undo to the last position where it was the learner's move, before their latest move.
		const plies = this.game.turn === this.side ? 2 : 1;
		return history - plies >= this.openingMoves.length ? plies : 0;
	}

	#reset() {
		this.flash = null;
		this.explanation = null;
		this.message = null;
		this.opportunity = null;
		this.#before = null;
		this.#after = null;
		this.hintLevel = 0;
		this.#hintMove = null;
	}

	/** Plays the computer's moves until it's the learner's turn, then prepares that turn. */
	async #continue(generation: number) {
		if (this.#checkOver()) return;
		if (this.game.turn !== this.side) {
			await this.#computerMove(generation);
			return;
		}
		await this.#prepareLearnerTurn(generation);
	}

	async #afterLearnerMove(generation: number) {
		if (this.#checkOver()) return;
		await this.#computerMove(generation);
	}

	async #prepareLearnerTurn(generation: number) {
		this.phase = 'thinking';
		this.hintLevel = 0;
		this.#hintMove = null;
		const fen = this.game.fen;
		const node = this.bundle.nodes[toEpd(fen)];
		if (node?.candidates.length) {
			this.#before = fromNode(fen, node);
		} else if (this.inOpening) {
			this.#before = null; // the defining move needs no grading
		} else {
			const analysis = await this.#analyse(fen);
			if (generation !== this.#generation) return;
			if (!analysis) return;
			this.#before = analysis;
		}
		if (this.#before?.lines[0]) this.evaluation = this.#before.lines[0].score;
		this.#thinkingSince = this.#now.getTime();
		this.phase = 'your-move';
	}

	async #computerMove(generation: number) {
		this.phase = 'thinking';
		const fen = this.game.fen;
		const epd = toEpd(fen);
		const opponent: Side = this.side === 'w' ? 'b' : 'w';
		const ply = this.game.uciHistory.length;
		let move: string;
		// The learner's winning chances before the reply, when the reply could be an opportunity.
		let chanceBefore: number | null = null;

		if (ply < this.openingMoves.length) {
			move = this.openingMoves[ply];
		} else if (this.#book.continuations(epd).length) {
			// Book replies include dubious theory: the learner's chance to punish it.
			move = this.#bookReply(epd);
			const best = this.bundle.nodes[epd]?.candidates[0];
			if (best) chanceBefore = winChance(best.score, this.side);
		} else {
			const analysis = this.#after?.fen === fen ? this.#after : await this.#analyse(fen);
			if (generation !== this.#generation || !analysis) return;
			if (!analysis.lines.length) {
				this.#checkOver();
				return;
			}
			const choice = chooseReply(analysis.lines, opponent, {
				mistakeRate: this.#options.mistakeRate ?? 0.15,
				random: this.#options.random ?? Math.random
			});
			move = choice.line.move;
			// Only a planted mistake is announced off the book; natural replies aren't opportunities.
			if (choice.kind === 'mistake') chanceBefore = winChance(analysis.lines[0].score, this.side);
		}

		await this.#wait(this.#options.opponentDelayMs ?? 450);
		if (generation !== this.#generation) return;
		const san = sanOf(fen, move);
		this.game.move(parseUci(move));
		this.#after = null;
		this.#visit();
		if (this.#checkOver()) return;
		await this.#prepareLearnerTurn(generation);
		if (generation !== this.#generation) return;

		const bestNow = this.#before?.lines[0];
		const gain = chanceBefore !== null && bestNow ? winChance(bestNow.score, this.side) - chanceBefore : 0;
		this.opportunity = gain >= OPPORTUNITY_MIN_GAIN ? { san } : null;
	}

	/**
	 * A book reply, weighted toward the lines the learner hasn't found. The square root keeps a move
	 * with a hundred lines behind it from drowning out the rest, and unsound replies are discounted so
	 * that dubious theory turns up now and then — something to punish — rather than half the time.
	 */
	#bookReply(epd: string): string {
		const node = this.bundle.nodes[epd];
		const mover = epd.split(' ')[1] as Side;
		const soundness = (uci: string) => {
			const best = node?.candidates[0];
			const score =
				node?.candidates.find((c) => c.uci === uci)?.score ??
				this.bundle.nodes[toEpd(new Chess(`${epd} 0 1`).move(parseUci(uci)).after)]?.candidates[0]?.score;
			if (!best || !score) return 0.5;
			const loss = winChance(best.score, mover) - winChance(score, mover);
			return loss < 0.06 ? 1 : loss < 0.15 ? 0.5 : 0.15;
		};
		const options = this.#book.continuations(epd).map(({ uci, lines }) => ({
			uci,
			weight:
				Math.sqrt(lines.reduce((sum, line) => sum + (this.#stages.get(line.key) === 'discovered' ? KNOWN_LINE_WEIGHT : 1), 0)) *
				soundness(uci)
		}));
		const total = options.reduce((sum, o) => sum + o.weight, 0);
		let pick = (this.#options.random ?? Math.random)() * total;
		for (const option of options) {
			pick -= option.weight;
			if (pick <= 0) return option.uci;
		}
		return options.at(-1)!.uci;
	}

	/** The learner's move's evaluation: from the analysis before it, the book, or a fresh search. */
	async #scoreOfMove(before: Analysis, uci: string): Promise<EngineScore> {
		const known = before.lines.find((l) => l.move === uci);
		if (known) {
			this.evaluation = known.score;
			return known.score;
		}
		const ended = scoreOfEnded(this.game, this.side);
		if (ended) {
			this.evaluation = ended;
			return ended;
		}
		const fen = this.game.fen;
		const node = this.bundle.nodes[toEpd(fen)];
		if (node?.candidates[0]) {
			this.evaluation = node.candidates[0].score;
			return node.candidates[0].score;
		}
		const analysis = await this.#analyse(fen);
		this.#after = analysis;
		const score = analysis?.lines[0]?.score ?? before.lines[0].score;
		this.evaluation = score;
		return score;
	}

	#describe(verdict: Verdict, { book, wasInBook, better }: { book: boolean; wasInBook: boolean; better: string }): Message {
		const opportunity = this.opportunity;
		if (book) {
			if (isSound(verdict)) {
				return opportunity
					? { tone: 'best', text: `Punished! ${opportunity.san} was a mistake — and that's the established answer.` }
					: { tone: 'best', text: 'An established move.' };
			}
			return { tone: 'warn', text: `An established move, but a dubious one — ${better} was better.` };
		}
		const leaving = wasInBook ? ' It leaves the established lines, though.' : '';
		switch (verdict) {
			case 'best':
				return { tone: 'best', text: `${opportunity ? `Punished! ${opportunity.san} was a mistake.` : 'Best move.'}${leaving}` };
			case 'good':
				return { tone: 'good', text: `${opportunity ? `Good — you took advantage of ${opportunity.san}.` : 'Good move.'}${leaving}` };
			default:
				return { tone: 'warn', text: `Slightly inaccurate — ${better} was better.${leaving}` };
		}
	}

	/** Records the lines the current position enters or completes. */
	#visit() {
		const epd = toEpd(this.game.fen);
		const entered: IndexedLine[] = [];
		const discovered: IndexedLine[] = [];
		const assisted: IndexedLine[] = [];

		const known: IndexedLine[] = [];

		for (const { line, index } of this.#book.at(epd)) {
			const stage = this.#stages.get(line.key);
			if (index < line.entry) continue;
			if (stage === 'discovered') {
				if (index === line.moves.length) known.push(line);
				continue;
			}
			if (index === line.moves.length) {
				const helped = line.epds.slice(this.openingMoves.length, -1).some((p) => this.#shown.has(p));
				if (helped) {
					assisted.push(line);
					if (!stage) this.#record(line, 'entered');
				} else {
					discovered.push(line);
					this.#record(line, 'discovered');
				}
			}
			if (index < line.moves.length && !stage) {
				entered.push(line);
				this.#record(line, 'entered');
			}
		}

		const push = (kind: LineStage, lines: IndexedLine[], flags: { assisted?: boolean; known?: boolean } = {}) => {
			if (!lines.length) return;
			const event = {
				id: ++this.#eventId,
				kind,
				lines,
				assisted: flags.assisted ?? false,
				known: flags.known ?? false,
				ply: this.game.uciHistory.length
			};
			this.events = [...this.events.slice(-4), event];
		};
		push('entered', entered);
		// Completions come last, so the newest event is the one to celebrate. Whichever side's move reached the end.
		push('discovered', known, { known: true });
		push('discovered', assisted, { assisted: true });
		push('discovered', discovered);
	}

	#record(line: IndexedLine, stage: LineStage) {
		this.#stages.set(line.key, stage);
		this.#stageVersion++;
		this.#options.onDiscovery?.({ bundleId: this.bundle.id, line: line.key, stage, at: this.#now.toISOString() });
	}

	/** The move a hint points at: the book move keeping the most unfound lines open, else the engine's best. */
	#suggest(): string | null {
		const epd = toEpd(this.game.fen);
		if (this.inOpening) return this.openingMoves[this.game.uciHistory.length];
		const best = this.#before?.lines[0]?.move ?? null;
		const scored = this.#book
			.continuations(epd)
			.filter(({ lines }) => lines.some((l) => !l.dubious))
			.map(({ uci, lines }) => ({ uci, open: lines.filter((l) => !l.dubious && this.#stages.get(l.key) !== 'discovered').length }))
			.sort((a, b) => b.open - a.open || Number(b.uci === best) - Number(a.uci === best));
		return scored[0]?.uci ?? best;
	}

	async #analyse(fen: string): Promise<Analysis | null> {
		try {
			if (!this.#engine) {
				this.loadingEngine = true;
				this.#engine = await this.#options.engine();
			}
			return await this.#engine.analyse(fen, { multipv: 6, moveTimeMs: this.#options.moveTimeMs ?? 700 });
		} catch (error) {
			this.phase = 'over';
			this.message = { tone: 'bad', text: `The engine couldn't run: ${(error as Error).message}` };
			return null;
		} finally {
			this.loadingEngine = false;
		}
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
