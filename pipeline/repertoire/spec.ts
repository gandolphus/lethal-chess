import type { Side } from '../../src/lib/drill/bundle.ts';

export type OpeningGroup = 'white-e4' | 'white-d4' | 'white-flank' | 'black-e4' | 'black-d4';

export type RepertoireSpec = {
	id: string;
	name: string;
	side: Side;
	group: OpeningGroup;
	/** Editorial tags: why this opening is in the set. */
	tags: ('popular' | 'aggressive' | 'gambit' | 'system' | 'solid')[];
	/** UCI moves from the initial position to where the repertoire starts. */
	rootMoves: string[];
	/** Stop expanding past this ply (positions there are still stored for grading). */
	maxPly: number;
	/** Maximum learner decisions in the tree — the card budget. */
	learnerBudget: number;
	/** A learner move this close to the engine's best counts as sound. */
	soundCp: number;
	/** Opponent replies this close to best are drilled. */
	replyCp: number;
	maxReplies: number;
};

// Starting values, tuned for a first-time learner: deep enough to carry ideas,
// small enough to finish. Revisit with real attempt data.
const NOVICE = { maxPly: 22, learnerBudget: 180, soundCp: 35, replyCp: 60, maxReplies: 4 } as const;

type Entry = Omit<RepertoireSpec, keyof typeof NOVICE>;

const entries: Entry[] = [
	// White, 1.e4
	{ id: 'ruy-lopez', name: 'Ruy Lopez', side: 'w', group: 'white-e4', tags: ['popular'], rootMoves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'] },
	{ id: 'italian-game', name: 'Italian Game', side: 'w', group: 'white-e4', tags: ['popular'], rootMoves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'] },
	{ id: 'scotch-game', name: 'Scotch Game', side: 'w', group: 'white-e4', tags: ['popular'], rootMoves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4'] },
	{ id: 'vienna-game', name: 'Vienna Game', side: 'w', group: 'white-e4', tags: ['aggressive'], rootMoves: ['e2e4', 'e7e5', 'b1c3'] },
	{ id: 'kings-gambit', name: "King's Gambit", side: 'w', group: 'white-e4', tags: ['aggressive', 'gambit'], rootMoves: ['e2e4', 'e7e5', 'f2f4'] },
	{ id: 'evans-gambit', name: 'Evans Gambit', side: 'w', group: 'white-e4', tags: ['aggressive', 'gambit'], rootMoves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'b2b4'] },
	{ id: 'danish-gambit', name: 'Danish Gambit', side: 'w', group: 'white-e4', tags: ['aggressive', 'gambit'], rootMoves: ['e2e4', 'e7e5', 'd2d4', 'e5d4', 'c2c3'] },
	{ id: 'smith-morra-gambit', name: 'Smith-Morra Gambit', side: 'w', group: 'white-e4', tags: ['aggressive', 'gambit'], rootMoves: ['e2e4', 'c7c5', 'd2d4', 'c5d4', 'c2c3'] },

	// White, 1.d4
	{ id: 'queens-gambit', name: "Queen's Gambit", side: 'w', group: 'white-d4', tags: ['popular'], rootMoves: ['d2d4', 'd7d5', 'c2c4'] },
	{ id: 'london-system', name: 'London System', side: 'w', group: 'white-d4', tags: ['popular', 'system'], rootMoves: ['d2d4', 'd7d5', 'c1f4'] },
	{ id: 'catalan', name: 'Catalan Opening', side: 'w', group: 'white-d4', tags: ['solid'], rootMoves: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g2g3'] },

	// White, flank
	{ id: 'english', name: 'English Opening', side: 'w', group: 'white-flank', tags: ['popular'], rootMoves: ['c2c4'] },
	{ id: 'reti', name: 'Réti Opening', side: 'w', group: 'white-flank', tags: ['solid'], rootMoves: ['g1f3', 'd7d5', 'c2c4'] },

	// Black against 1.e4
	{ id: 'sicilian', name: 'Sicilian Defense', side: 'b', group: 'black-e4', tags: ['popular'], rootMoves: ['e2e4', 'c7c5'] },
	{ id: 'sicilian-dragon', name: 'Sicilian Dragon', side: 'b', group: 'black-e4', tags: ['aggressive'], rootMoves: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'g7g6'] },
	{ id: 'caro-kann', name: 'Caro-Kann Defense', side: 'b', group: 'black-e4', tags: ['popular', 'solid'], rootMoves: ['e2e4', 'c7c6'] },
	{ id: 'french', name: 'French Defense', side: 'b', group: 'black-e4', tags: ['popular', 'solid'], rootMoves: ['e2e4', 'e7e6'] },
	{ id: 'scandinavian', name: 'Scandinavian Defense', side: 'b', group: 'black-e4', tags: ['popular'], rootMoves: ['e2e4', 'd7d5'] },
	{ id: 'pirc', name: 'Pirc Defense', side: 'b', group: 'black-e4', tags: ['aggressive'], rootMoves: ['e2e4', 'd7d6', 'd2d4', 'g8f6', 'b1c3', 'g7g6'] },
	{ id: 'alekhine', name: "Alekhine's Defense", side: 'b', group: 'black-e4', tags: ['aggressive'], rootMoves: ['e2e4', 'g8f6'] },

	// Black against 1.d4
	{ id: 'queens-gambit-declined', name: "Queen's Gambit Declined", side: 'b', group: 'black-d4', tags: ['popular', 'solid'], rootMoves: ['d2d4', 'd7d5', 'c2c4', 'e7e6'] },
	{ id: 'slav', name: 'Slav Defense', side: 'b', group: 'black-d4', tags: ['popular', 'solid'], rootMoves: ['d2d4', 'd7d5', 'c2c4', 'c7c6'] },
	{ id: 'kings-indian', name: "King's Indian Defense", side: 'b', group: 'black-d4', tags: ['popular', 'aggressive'], rootMoves: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7', 'e2e4', 'd7d6'] },
	{ id: 'nimzo-indian', name: 'Nimzo-Indian Defense', side: 'b', group: 'black-d4', tags: ['popular'], rootMoves: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4'] },
	{ id: 'grunfeld', name: 'Grünfeld Defense', side: 'b', group: 'black-d4', tags: ['aggressive'], rootMoves: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'd7d5'] },
	{ id: 'dutch', name: 'Dutch Defense', side: 'b', group: 'black-d4', tags: ['aggressive'], rootMoves: ['d2d4', 'f7f5'] },
	{ id: 'benko-gambit', name: 'Benko Gambit', side: 'b', group: 'black-d4', tags: ['aggressive', 'gambit'], rootMoves: ['d2d4', 'g8f6', 'c2c4', 'c7c5', 'd4d5', 'b7b5'] },
	{ id: 'budapest-gambit', name: 'Budapest Gambit', side: 'b', group: 'black-d4', tags: ['aggressive', 'gambit'], rootMoves: ['d2d4', 'g8f6', 'c2c4', 'e7e5'] }
];

export const LAUNCH_REPERTOIRES: RepertoireSpec[] = entries.map((entry) => ({ ...entry, ...NOVICE }));
