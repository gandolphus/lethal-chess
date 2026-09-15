import { Chess } from 'chess.js';

/** The position after a SAN move list such as "1.e4 e5 2.Nf3", or the start position if it does not parse. */
export function fenAfter(moves: string): string {
	const chess = new Chess();
	for (const token of moves.split(/\s+/)) {
		const san = token.replace(/^\d+\.(\.\.)?/, '');
		if (!san) continue;
		try {
			chess.move(san);
		} catch {
			break;
		}
	}
	return chess.fen();
}

/** Pairs a SAN history into numbered rows for a move list. */
export function movePairs(history: string[]): { number: number; white: string; black: string }[] {
	const pairs = [];
	for (let i = 0; i < history.length; i += 2) {
		pairs.push({ number: i / 2 + 1, white: history[i], black: history[i + 1] ?? '' });
	}
	return pairs;
}

/** Five-step scale for "how much precision this demands", from centipawns the second-best move gives up. */
export function sharpnessLevel(cp: number | null | undefined): number {
	if (cp === null || cp === undefined) return 0;
	if (cp >= 80) return 5;
	if (cp >= 45) return 4;
	if (cp >= 30) return 3;
	if (cp >= 15) return 2;
	return 1;
}

export const SHARPNESS_WORDS = ['', 'Wide', 'Some choice', 'Narrow', 'Sharp', 'Only move'];

export type Score = { cp: number } | { mate: number };

export const formatScore = (score: Score) => {
	if ('mate' in score) return `#${score.mate}`;
	const pawns = score.cp / 100;
	return `${pawns > 0 ? '+' : ''}${pawns.toFixed(2)}`;
};

/** Short form for a bar label: "+1.2", "−0.4", "M3". */
export const formatEval = (score: Score) => {
	if ('mate' in score) return `M${Math.abs(score.mate)}`;
	const pawns = score.cp / 100;
	return `${pawns > 0 ? '+' : pawns < 0 ? '−' : ''}${Math.abs(pawns).toFixed(1)}`;
};
