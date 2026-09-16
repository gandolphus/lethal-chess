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
import { addMove, createRoot, pathTo, type MoveNode, type MoveQuality } from './movetree';

export type ExplorePhase =
	| 'thinking' // analysing, or the computer is about to move
	| 'your-move'
	| 'browse' // looking back through the game; play resumes from wherever the learner stops
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

/** A move's mark, from the winning chances it gave away — the scale every analysis board uses. */
export const qualityOfLoss = (loss: number): MoveQuality =>
	loss < 0.02 ? 'best' : loss < 0.1 ? 'good' : loss < 0.2 ? 'inaccuracy' : loss < 0.3 ? 'mistake' : 'blunder';

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
	explanation = $state<{ kind: 'refutation'; uci: string; san: string; line: string[]; stage: 'shown' } | null>(null);

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
		// Everything still running through this position, whether or not its entrance has been passed. The
		// card itself only appears once a line has been entered, but the count is of what is *reachable*:
		// gating it on the entrance made the number rise as the game went deeper, because more entrances
		// had been passed, when what a learner reads is "how much is left down here".
		const through = this.#book.at(toEpd(this.game.fen)).filter(({ line, index }) => index < line.moves.length);
		const inside = through.filter(({ line, index }) => index >= line.entry);
		if (!inside.length) return null;
		const unfound = inside.filter(({ line }) => this.#stages.get(line.key) !== 'discovered');
		const pool = unfound.length ? unfound : inside;
		const nearest = pool.reduce((a, b) => (b.line.moves.length - b.index < a.line.moves.length - a.index ? b : a));
		const reachable = through.filter(({ line }) => this.#stages.get(line.key) !== 'discovered');
		return {
			name: nearest.line.entryName ?? nearest.line.variation,
			lines: (reachable.length ? reachable : through).length,
			allKnown: !reachable.length,
			total: nearest.line.moves.length - nearest.line.entry,
			played: nearest.index - nearest.line.entry
		};
	});

	readonly arrows = $derived.by<Arrow[]>(() => {
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
	/**
	 * Everything played this game, branches and all; `current` is the move on the board. The tree is
	 * mutated in place and held raw — a deep proxy would break the identity checks it is built on — so
	 * `revision` is what readers watch.
	 */
	root = $state.raw<MoveNode>(createRoot());
	current = $state.raw<MoveNode>(this.root);
	revision = $state(0);
	/** The engine's line is replayed on the board during an explanation; those moves are not the game. */
	#replaying = false;
	/** Where the game stood when browsing began, so stepping back to it hands play back. */
	#live: MoveNode | null = null;
	/** The position right after the learner's last mistake, for "Why?"; null once it is answered or moved past. */
	#mistake = $state<string | null>(null);
	/** A punishable mistake is offered once; a second miss simply plays on. */
	#missed = 0;

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

	/**
	 * Stops this session for good: anything it is waiting on is discarded when it resolves. The page calls
	 * it before starting another session, so an abandoned game can't play a move or record a discovery.
	 */
	abandon() {
		this.#generation++;
	}

	/** A new game from the initial position. */
	async start(): Promise<void> {
		const generation = ++this.#generation;
		this.game.load([]);
		this.root = createRoot();
		this.current = this.root;
		this.revision++;
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
			this.#played(uci, legal.san, 'book');
			this.#visit();
			await this.#continue(generation);
			return 'best';
		}

		const before = this.#before;
		const best = before?.lines[0];
		if (!before || !best) return null;
		const wasInBook = this.inBook;

		this.phase = 'thinking';
		this.game.move(legal);
		// A move that transposes onto a line is established too, even when this position has no such edge.
		const book = this.#book.isBookMove(epd, uci) || this.#book.at(toEpd(this.game.fen)).some(({ index }) => index > 0);
		const node = this.#played(uci, legal.san, book ? 'book' : undefined);
		const played = await this.#scoreOfMove(before, uci);
		if (generation !== this.#generation || (this.phase as ExplorePhase) === 'over') return null;
		const verdict = verdictFor(lossFor(best, played, this.side), uci === best.move);
		if (!book) {
			node.quality = verdict;
			this.revision++;
		}
		const serious = verdict === 'mistake' || verdict === 'blunder';
		const wrong = !book && (serious || (this.opportunity && !isSound(verdict)));

		// A punishable mistake the learner walked past is the one thing worth stopping for, and it stops by
		// rewinding rather than freezing: the move comes back and the chance is named. Once only.
		if (wrong && this.opportunity && !this.#missed) {
			this.#missed++;
			this.game.undo();
			this.current = this.current.parent ?? this.current;
			this.flash = { from, to, kind: 'wrong' };
			this.message = { tone: 'bad', text: `You missed the chance to punish ${this.opportunity.san}. Try again — find it.` };
			this.phase = 'your-move';
			this.#thinkingSince = this.#now.getTime();
			return verdict;
		}

		this.flash = { from, to, kind: isSound(verdict) ? 'correct' : wrong ? 'wrong' : 'soft' };
		this.message = wrong ? this.#playOnMessage(verdict) : this.#describe(verdict, { book, wasInBook });
		// The position right after a mistake, so "Why?" can show what it allowed once play has moved on.
		this.#mistake = wrong ? this.game.fen : null;
		this.explanation = null;
		this.opportunity = null;
		this.#missed = 0;
		this.#visit();
		await this.#afterLearnerMove(generation);
		return verdict;
	}

	/** Whether there is a mistake to explain: the one on the board, or the one play has moved past. */
	readonly canExplain = $derived(Boolean(this.#mistake) && !this.explanation);

	/** Shows what the last mistake allowed: the reply that punishes it, and the engine's line. */
	async explain() {
		const fen = this.#mistake;
		if (!fen || this.explanation) return;
		const generation = this.#generation;
		const node = this.bundle.nodes[toEpd(fen)];
		let uci: string | undefined = node?.candidates[0]?.uci;
		let line: string[] = node?.line ?? [];
		if (!uci) {
			const analysis = this.#after?.fen === fen ? this.#after : await this.#analyse(fen);
			if (generation !== this.#generation) return;
			uci = analysis?.lines[0]?.move;
			line = analysis?.lines[0] ? sanLine(fen, analysis.lines[0].pv) : [];
		}
		if (!uci) return;
		const san = sanOf(fen, uci);
		this.explanation = { kind: 'refutation', uci, san, line: line.length ? line : [san], stage: 'shown' };
	}

	get canTakeBack() {
		return ['your-move', 'over'].includes(this.phase) && this.#takeBackPlies() > 0;
	}

	// ── browsing: past the book this is an analysis board, not a one-way street ──────────────────

	readonly canBack = $derived(Boolean(this.current.parent) && this.phase !== 'thinking');
	readonly canForward = $derived(this.revision >= 0 && this.current.children.length > 0 && this.phase !== 'thinking');
	/** Looking at the latest move of this branch, rather than back down the game. */
	readonly atTip = $derived(this.revision >= 0 && this.current.children.length === 0);

	/**
	 * Back one move of the learner's own — past the computer's reply, not half of it. The moves are kept:
	 * playing something else here starts a branch beside them.
	 */
	back() {
		if (!this.canBack) return;
		let at = this.current.parent!;
		while (at.parent && this.#turnAt(at) !== this.side) at = at.parent;
		this.#goTo(at);
	}

	/** Forward one move of the learner's own, following the branch the game continued with. */
	forward() {
		if (!this.canForward) return;
		let at = this.current.children[0];
		while (at.children.length && this.#turnAt(at) !== this.side) at = at.children[0];
		this.#goTo(at);
	}

	/** Jump to any move in the tree. */
	goTo(node: MoveNode) {
		if (this.phase === 'thinking') return;
		this.#goTo(node);
	}

	/**
	 * Picks up a line the learner has already been down: replays it from the start and hands play back at
	 * its end, so a line found once can be practised from. Only lines they have reached are offered —
	 * replaying a secret one would be giving it away.
	 */
	async resume(line: IndexedLine): Promise<void> {
		const generation = ++this.#generation;
		this.game.load([]);
		this.root = createRoot();
		let node = this.root;
		for (const uci of line.moves) {
			const legal = this.game.find(parseUci(uci));
			if (!legal) break;
			this.game.move(legal);
			node = addMove(node, uci, legal.san, 'book');
		}
		this.current = node;
		this.revision++;
		this.#live = null;
		this.#reset();
		this.events = [];
		this.evaluation = null;
		this.#visit();
		await this.#continue(generation);
	}

	/** Carries on from the move on the board; the moves after it stay as a branch. */
	async playFromHere() {
		if (this.phase !== 'browse') return;
		const generation = ++this.#generation;
		this.#live = null;
		this.#reset();
		await this.#continue(generation);
	}

	/** Records a move actually played in the game; replayed engine lines are not the game. */
	#played(uci: string, san: string, quality?: MoveQuality): MoveNode {
		if (this.#replaying) return this.current;
		this.current = addMove(this.current, uci, san, quality);
		this.revision++;
		return this.current;
	}

	/** Whose move it is *after* `node` has been played. */
	#turnAt(node: MoveNode): Side {
		return node.ply % 2 === 0 ? 'w' : 'b';
	}

	#goTo(node: MoveNode) {
		const generation = ++this.#generation;
		if (this.phase !== 'browse') this.#live = this.current;
		this.current = node;
		this.game.load(pathTo(node).map((move) => move.uci));
		this.#reset();
		this.phase = 'browse';
		// Stepping forward to where the game had got to hands play back, rather than stranding it.
		if (node === this.#live) {
			this.#live = null;
			void this.#continue(generation);
			return;
		}
		void this.#prepareBrowsed(generation);
	}

	/** Browsing shows what the engine makes of the position — but only past the book, and it stays playable. */
	async #prepareBrowsed(generation: number) {
		const fen = this.game.fen;
		const node = this.bundle.nodes[toEpd(fen)];
		const secret = this.#book.continuations(toEpd(fen)).length > 0 || this.inOpening;
		this.evaluation = secret ? null : (node?.candidates[0]?.score ?? null);
		if (node?.candidates.length) {
			this.#before = fromNode(fen, node);
			return;
		}
		if (secret) return;
		const analysis = await this.#analyse(fen);
		if (generation !== this.#generation || !analysis?.lines.length) return;
		this.#before = analysis;
		this.evaluation = analysis.lines[0].score;
	}

	/** Back to the learner's previous decision, past the computer's reply. */
	async takeBack() {
		if (!this.canTakeBack) return;
		const generation = ++this.#generation;
		for (let plies = this.#takeBackPlies(); plies > 0; plies--) {
			this.game.undo();
			this.current = this.current.parent ?? this.current;
		}
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
		this.#mistake = null;
		this.#missed = 0;
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
			if (!analysis.lines.length) {
				// Nothing to grade against: end the game rather than wait for a move that can't be judged.
				this.#stall();
				return;
			}
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
				if (!this.#checkOver()) this.#stall();
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
		// Book replies are theory; past it, how much the reply gave away is known once the position is analysed.
		const played = this.#played(move, san, chanceBefore === null ? 'book' : undefined);
		this.#after = null;
		this.#visit();
		if (this.#checkOver()) return;
		await this.#prepareLearnerTurn(generation);
		if (generation !== this.#generation) return;

		const bestNow = this.#before?.lines[0];
		const gain = chanceBefore !== null && bestNow ? winChance(bestNow.score, this.side) - chanceBefore : 0;
		if (chanceBefore !== null) {
			played.quality = qualityOfLoss(gain);
			this.revision++;
		}
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

	/**
	 * Past the book a mistake is played out rather than stopped: say what it was, and how to undo it.
	 * Never what to play instead — the whole exercise is finding that. Hint gives it away, in two presses,
	 * and only because it was asked twice.
	 */
	#playOnMessage(verdict: Verdict): Message {
		if (this.opportunity) {
			return {
				tone: 'bad',
				text: `You missed the chance to punish ${this.opportunity.san}. Watch the reply — or take it back and look again.`
			};
		}
		const what = verdict === 'blunder' ? 'A blunder — that can lose the game' : 'A mistake — it gives your opponent real chances';
		return { tone: 'bad', text: `${what}. See what it allows, or take it back — Hint is there if you want it.` };
	}

	#describe(verdict: Verdict, { book, wasInBook }: { book: boolean; wasInBook: boolean }): Message {
		const opportunity = this.opportunity;
		if (book) {
			if (isSound(verdict)) {
				return opportunity
					? { tone: 'best', text: `Punished! ${opportunity.san} was a mistake — and that's the established answer.` }
					: { tone: 'best', text: 'An established move.' };
			}
			return { tone: 'warn', text: 'An established move, but a dubious one — there is better here.' };
		}
		const leaving = wasInBook ? ' It leaves the established lines, though.' : '';
		switch (verdict) {
			case 'best':
				return { tone: 'best', text: `${opportunity ? `Punished! ${opportunity.san} was a mistake.` : 'Best move.'}${leaving}` };
			case 'good':
				return { tone: 'good', text: `${opportunity ? `Good — you took advantage of ${opportunity.san}.` : 'Good move.'}${leaving}` };
			default:
				return { tone: 'warn', text: `Slightly inaccurate — there was better.${leaving}` };
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
		const node = this.bundle.nodes[epd];
		const mover = epd.split(' ')[1] as Side;
		// Never point at a move the coach would then call a mistake: soundness first, then unfound lines.
		const sound = (uci: string) => {
			const played = node?.candidates.find((c) => c.uci === uci);
			if (!node?.candidates[0] || !played) return 1;
			return winChance(node.candidates[0].score, mover) - winChance(played.score, mover) < 0.1 ? 1 : 0;
		};
		const scored = this.#book
			.continuations(epd)
			.filter(({ lines }) => lines.some((l) => !l.dubious))
			.map(({ uci, lines }) => ({
				uci,
				sound: sound(uci),
				open: lines.filter((l) => !l.dubious && this.#stages.get(l.key) !== 'discovered').length
			}))
			.sort((a, b) => b.sound - a.sound || b.open - a.open || Number(b.uci === best) - Number(a.uci === best));
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

	/** The engine had nothing to say about a live position: stop cleanly instead of waiting forever. */
	#stall() {
		this.phase = 'over';
		this.message = { tone: 'bad', text: 'The engine had no move for this position. Start a new game.' };
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
