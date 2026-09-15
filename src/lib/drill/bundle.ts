// Format of a per-opening bundle: produced offline by pipeline/repertoire/build.ts,
// consumed by the drill in the browser. This file is the single definition both sides share.

export type Side = 'w' | 'b';

/** Centipawns or mate, always from White's point of view. */
export type Score = { cp: number } | { mate: number };

export type Candidate = {
	uci: string;
	san: string;
	score: Score;
};

export type Reply = {
	uci: string;
	san: string;
	/** Relative likelihood the drill plays this reply; weights at a node sum to 1. */
	weight: number;
};

export type BundleNode = {
	/** Position after the moves that led here; EPD, so transpositions share a node. */
	epd: string;
	ply: number;
	/** Catalog name if a named line ends exactly at this position. */
	name?: string;
	depth: number;
	/** Engine candidates from one multi-PV search, best first. */
	candidates: Candidate[];
	/** Principal variation in SAN, starting with candidates[0]. */
	line: string[];
	/** The learner's move here (learner-to-move nodes inside the tree only). */
	move?: Candidate;
	/** Opponent replies the drill plays (opponent-to-move nodes inside the tree only). */
	replies?: Reply[];
	/** How narrow the position is for the side to move: centipawns the second-best move gives up. */
	sharpness?: number;
};

export type Bundle = {
	id: string;
	name: string;
	side: Side;
	/** UCI moves from the initial position to where walks start (empty: walks start from move 1). */
	rootMoves: string[];
	/** The moves that define the opening, e.g. 1.e4 e5 2.Nf3 Nc6 3.Bb5 — for display. */
	openingMoves?: string[];
	rootEpd: string;
	nodes: Record<string, BundleNode>;
	/** Tolerances the bundle was built with, so grading uses the same numbers. */
	tolerances: { soundCp: number; replyCp: number };
	stats: { learnerNodes: number; opponentNodes: number; maxPly: number; missingEvals: number };
	source: { evalCacheRecords: number; builtAt: string };
};

/** One opening in `openings/repertoires/index.json`, written by the builder next to the bundles. */
export type OpeningIndexEntry = {
	id: string;
	name: string;
	side: Side;
	group: 'white-e4' | 'white-d4' | 'white-flank' | 'black-e4' | 'black-d4';
	tags: string[];
	/** The moves to the repertoire's root, in SAN with move numbers, e.g. "1.e4 e5 2.Nf3". */
	moves: string;
	learnerNodes: number;
	maxPly: number;
	/**
	 * Mean centipawns the opponent's second-best move gives up, over the opponent's
	 * decisions in the tree: how much precision this repertoire demands of opponents.
	 */
	opponentSharpness: number | null;
	bytes: number;
};

const MATE_BASE = 100_000;

/** Maps a score onto one comparable number from `side`'s point of view. Shorter mates rank higher. */
export function scoreFor(score: Score, side: Side): number {
	const white = 'mate' in score ? (score.mate > 0 ? MATE_BASE - score.mate : -MATE_BASE - score.mate) : score.cp;
	return side === 'w' ? white : -white;
}
