/**
 * The moves played in an exploration, as a tree: going back and playing something else makes a branch
 * rather than throwing the old moves away. Conventions follow the analysis boards people already know —
 * variations sit under the move they branch from (Lichess), and each move carries how good it was, from
 * winning chances lost (chess.com's classifications).
 */

export type MoveQuality = 'book' | 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export type MoveNode = {
	id: number;
	/** The move that led here; empty at the root. */
	uci: string;
	san: string;
	/** Half-moves from the start: 1 is White's first move. 0 is the root. */
	ply: number;
	quality?: MoveQuality;
	parent: MoveNode | null;
	/** First child is the line this branch continues with; the rest are alternatives. */
	children: MoveNode[];
};

let nextId = 0;

export const createRoot = (): MoveNode => ({ id: ++nextId, uci: '', san: '', ply: 0, parent: null, children: [] });

/** Follows an existing child with this move, or starts a new branch. */
export function addMove(parent: MoveNode, uci: string, san: string, quality?: MoveQuality): MoveNode {
	const existing = parent.children.find((child) => child.uci === uci);
	if (existing) {
		if (quality) existing.quality = quality;
		return existing;
	}
	const node: MoveNode = { id: ++nextId, uci, san, ply: parent.ply + 1, quality, parent, children: [] };
	parent.children.push(node);
	return node;
}

/** The moves from the root down to `node`, in order. */
export function pathTo(node: MoveNode): MoveNode[] {
	const path: MoveNode[] = [];
	for (let at: MoveNode | null = node; at && at.parent; at = at.parent) path.unshift(at);
	return path;
}

/** Where `node` sits among its siblings: the first child is the line, the others are alternatives. */
export const isAlternative = (node: MoveNode) => (node.parent?.children.indexOf(node) ?? 0) > 0;

/** The node `plies` half-moves from the root along the path to `from`, or the root itself. */
export function nodeAtPly(from: MoveNode, ply: number): MoveNode | null {
	for (let at: MoveNode | null = from; at; at = at.parent) if (at.ply === ply) return at;
	return null;
}

/** Drops `node` and everything after it. The root cannot be removed. */
export function remove(node: MoveNode): MoveNode | null {
	const parent = node.parent;
	if (!parent) return null;
	parent.children = parent.children.filter((child) => child !== node);
	return parent;
}

/** Makes the branch through `node` the line its parent continues with, one level up. */
export function promote(node: MoveNode): void {
	const parent = node.parent;
	if (!parent) return;
	parent.children = [node, ...parent.children.filter((child) => child !== node)];
}

/** A run of moves to draw on one line; variations follow the run they branch from, one level deeper. */
export type Segment = { depth: number; moves: MoveNode[] };

/**
 * The tree in reading order: a run of moves, then each alternative to a move in that run as its own
 * indented run, recursively — the arrangement analysis boards have settled on. A reader can follow one
 * line to its end without hopping between depths.
 */
export function segments(root: MoveNode, depth = 0, seen = new Set<MoveNode>()): Segment[] {
	const run: MoveNode[] = [];
	const branches: Segment[] = [];

	for (let at: MoveNode | undefined = root.children[0]; at; at = at.children[0]) {
		if (seen.has(at)) break;
		seen.add(at);
		run.push(at);
		// Anything else played from the same position becomes its own run, one level under this one. Only
		// the run that carries the first child spawns them, so every alternative to one move shares a depth.
		if (at === at.parent!.children[0]) {
			for (const alternative of at.parent!.children.slice(1)) {
				if (seen.has(alternative)) continue;
				branches.push(...segments({ ...alternative.parent!, children: [alternative] }, depth + 1, seen));
			}
		}
	}

	return run.length ? [{ depth, moves: run }, ...branches] : branches;
}

/** "12." before a white move, "12…" before a black one; only where a reader needs it. */
export const moveNumber = (ply: number) => (ply % 2 === 1 ? `${(ply + 1) / 2}.` : `${ply / 2}…`);
