import { Chess } from 'chess.js';
import type { Bundle, BundleNode } from './bundle';

export const toEpd = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

export function childEpd(epd: string, uci: string): string {
	const chess = new Chess(`${epd} 0 1`);
	chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
	return toEpd(chess.fen());
}

export const isLearnerNode = (node: BundleNode | undefined): node is BundleNode & { move: NonNullable<BundleNode['move']> } =>
	Boolean(node?.move);

export const learnerCards = (bundle: Bundle): string[] =>
	Object.values(bundle.nodes).filter(isLearnerNode).map((node) => node.epd);

/**
 * For every node, the learner cards reachable from it (itself included). Used to
 * steer opponent replies toward branches that need practice. Transpositions can
 * make the graph a DAG, so results are memoised per position.
 */
export function cardsBelow(bundle: Bundle): Map<string, Set<string>> {
	const memo = new Map<string, Set<string>>();

	const visit = (epd: string, path: Set<string>): Set<string> => {
		const cached = memo.get(epd);
		if (cached) return cached;
		const node = bundle.nodes[epd];
		const cards = new Set<string>();
		if (!node || path.has(epd)) return cards; // off-tree, or a repetition cycle
		path.add(epd);
		if (isLearnerNode(node)) {
			cards.add(epd);
			for (const card of visit(childEpd(epd, node.move.uci), path)) cards.add(card);
		}
		for (const reply of node.replies ?? []) {
			for (const card of visit(childEpd(epd, reply.uci), path)) cards.add(card);
		}
		path.delete(epd);
		memo.set(epd, cards);
		return cards;
	};

	for (const epd of Object.keys(bundle.nodes)) visit(epd, new Set());
	return memo;
}
