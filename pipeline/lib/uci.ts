import type { Chess, Square } from 'chess.js';

/**
 * The Lichess eval db writes castling as king-takes-own-rook (`e1h1`, `e8a8`),
 * the Chess960 convention; chess.js only accepts the standard form (`e1g1`).
 * In standard chess a king can never legally land on its own rook, so that
 * pattern is unambiguous. Every move read from the eval cache must pass
 * through here before it touches chess.js.
 */
export function normalizeCastling(chess: Chess, uci: string): string {
	const from = uci.slice(0, 2) as Square;
	const to = uci.slice(2, 4) as Square;
	const king = chess.get(from);
	if (king?.type !== 'k') return uci;
	const target = chess.get(to);
	if (target?.type !== 'r' || target.color !== king.color) return uci;
	return `${from}${to[0] > from[0] ? 'g' : 'c'}${from[1]}`;
}
