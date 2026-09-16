import { Chess } from 'chess.js';
import type { IndexedLine, LineStage } from './book';

/**
 * The chart: an opening's lines drawn as a tree, x = ply, one band per variation. The layout is
 * pure so it can be tested and rebuilt wholesale on every discovery (a few milliseconds).
 */

export type Zoom = 'overview' | 'detail';

/** The edge into a node: lit = on a discovered line, ember = played on an entered line, ember-dim = the entered line's secret continuation. */
export type EdgeState = 'fog' | 'ember' | 'ember-dim' | 'lit';

/** Where the game is: `index` moves along `line`. */
export type Here = { line: IndexedLine; index: number };

export type BandKind = 'variation' | 'sidelines' | 'dubious';

export type Band = { name: string; kind: BandKind; lines: IndexedLine[]; discovered: number; entered: number };

export type TrieNode = {
	ply: number;
	/** The move into this node, UCI; null at the root. */
	uci: string | null;
	/** Largest subtree first. */
	children: TrieNode[];
	/** Every line through this node. */
	lines: IndexedLine[];
	/** Lines ending here (transpositions share an end). */
	ends: IndexedLine[];
	y: number;
};

export const SIDELINES = 'Sidelines';
export const DUBIOUS = 'Dubious lines';

const shortVariation = (name: string) => name.replace(/^[^:]+:\s*/, '') || name;

/** A line's name without its variation, e.g. "Breyer Defense" under "Ruy Lopez: Closed". */
const shortLine = (line: IndexedLine) =>
	line.name === line.variation ? 'Main line' : line.name.slice(line.variation.length).replace(/^,\s*/, '');

/** Where a line is entered, as a ply; a line with no entrance is entered at its last move. */
export const entranceOf = (line: IndexedLine) => Math.min(line.entry, line.moves.length - 1);

/** One band per variation, largest first; single-line variations fold into Sidelines; dubious lines sit apart at the bottom. */
export function bandsOf(lines: IndexedLine[], stages: Map<string, LineStage>): Band[] {
	const byVariation = new Map<string, IndexedLine[]>();
	const dubious: IndexedLine[] = [];
	for (const line of lines) {
		if (line.dubious) {
			dubious.push(line);
			continue;
		}
		const group = byVariation.get(line.variation) ?? [];
		group.push(line);
		byVariation.set(line.variation, group);
	}
	const band = (name: string, kind: BandKind, members: IndexedLine[]): Band => ({
		name,
		kind,
		lines: members,
		discovered: members.filter((l) => stages.get(l.key) === 'discovered').length,
		entered: members.filter((l) => stages.get(l.key) === 'entered').length
	});
	const bands: Band[] = [];
	const sidelines: IndexedLine[] = [];
	for (const [name, members] of byVariation) {
		if (members.length === 1) sidelines.push(members[0]);
		else bands.push(band(name, 'variation', members));
	}
	bands.sort((a, b) => b.lines.length - a.lines.length || a.name.localeCompare(b.name));
	if (sidelines.length) bands.push(band(SIDELINES, 'sidelines', sidelines));
	if (dubious.length) bands.push(band(DUBIOUS, 'dubious', dubious));
	return bands;
}

/** A trie of the lines' moves from ply `root`, children ordered largest subtree first. */
export function trie(lines: IndexedLine[], root: number): TrieNode {
	const node = (ply: number, uci: string | null): TrieNode => ({ ply, uci, children: [], lines: [], ends: [], y: 0 });
	const top = node(root, null);
	for (const line of lines) {
		let at = top;
		at.lines.push(line);
		for (let ply = root; ply < line.moves.length; ply++) {
			const uci = line.moves[ply];
			let next = at.children.find((c) => c.uci === uci);
			if (!next) {
				next = node(ply + 1, uci);
				at.children.push(next);
			}
			next.lines.push(line);
			at = next;
		}
		at.ends.push(line);
	}
	const sort = (n: TrieNode) => {
		n.children.sort((a, b) => b.lines.length - a.lines.length);
		n.children.forEach(sort);
	};
	sort(top);
	return top;
}

/** Tidy placement: leaves stacked `row` apart from `top`, each parent centred on its first and last child. Returns the leaf count. */
export function place(node: TrieNode, row: number, top: number): number {
	let leaves = 0;
	const visit = (n: TrieNode) => {
		if (!n.children.length) {
			n.y = top + leaves * row + row / 2;
			leaves++;
			return;
		}
		n.children.forEach(visit);
		n.y = (n.children[0].y + n.children[n.children.length - 1].y) / 2;
	};
	visit(node);
	return leaves;
}

const isHere = (line: IndexedLine, here: Here | null) => here !== null && here.line.key === line.key;

/** The state of the edge into `node`: lit > ember > ember-dim > fog over the lines through it. */
export function edgeState(node: TrieNode, stages: Map<string, LineStage>, here: Here | null): EdgeState {
	let state: EdgeState = 'fog';
	for (const line of node.lines) {
		const stage = stages.get(line.key);
		if (stage === 'discovered') return 'lit';
		const onIt = isHere(line, here);
		if (stage === 'entered') {
			// Solid up to the entrance, and as far as the game has come on the line being followed.
			const solidTo = onIt ? Math.max(entranceOf(line), here!.index) : entranceOf(line);
			if (node.ply <= solidTo) state = 'ember';
			else if (state === 'fog') state = 'ember-dim';
		} else if (onIt && node.ply <= here!.index) {
			// The game is on a line it hasn't entered: only the moves played so far are warm, the entrance stays secret.
			state = 'ember';
		}
	}
	return state;
}

const sanCache = new WeakMap<IndexedLine, string[]>();

/** A line's moves in SAN, converted once. */
export function sanOf(line: IndexedLine): string[] {
	let san = sanCache.get(line);
	if (!san) {
		const chess = new Chess();
		san = line.moves.map((uci) => chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san);
		sanCache.set(line, san);
	}
	return san;
}

export type LayoutOptions = {
	zoom: Zoom;
	/** Available width in px; Overview fits it, Detail may exceed it. */
	width: number;
	/** Plies of the opening's defining moves: the root column. */
	opening: number;
	here?: Here | null;
	/** Coarse pointers get taller rows, so a line's end is something a thumb can actually hit. */
	touch?: boolean;
};

export type LayoutBand = {
	name: string;
	label: string;
	kind: BandKind;
	y: number;
	height: number;
	count: string;
	here: boolean;
};

export type LayoutEdge = { d: string; state: EdgeState; label: { x: number; y: number; text: string } | null };

/**
 * One move along a line, where its edge lands. Drawn as a bead so a line's length can be counted at a
 * glance, and the point a pointer hovering the map is matched against. `line` is a line through this move
 * the learner has been down, or null where the move is still secret — the same rule the edge labels
 * follow, because a tooltip that named a secret move would hand the theory over.
 */
export type LayoutMove = {
	x: number;
	y: number;
	ply: number;
	state: EdgeState;
	line: IndexedLine | null;
	/** A line's last move. It carries its own, larger node, so no bead is drawn — but it is still hoverable. */
	end: boolean;
};

export type LayoutNode = {
	x: number;
	y: number;
	r: number;
	kind: 'lit' | 'ember' | 'secret' | 'branch';
	label: string | null;
	/** The line this end completes, when it is one the learner has been down and may pick up again. */
	line?: IndexedLine;
};

export type Layout = {
	width: number;
	height: number;
	bands: LayoutBand[];
	edges: LayoutEdge[];
	moves: LayoutMove[];
	nodes: LayoutNode[];
	here: { x: number; y: number } | null;
};

const ROW: Record<Zoom, number> = { detail: 16, overview: 7 };
const TOUCH_ROW: Record<Zoom, number> = { detail: 28, overview: 12 };
const HEAD: Record<Zoom, number> = { detail: 34, overview: 14 };
const GAP: Record<Zoom, number> = { detail: 20, overview: 10 };
// Just enough air above the first band; there is no longer a ruler up there to clear.
const TOP = 12;

/** The move that lands on a column: "4." for White's fourth, "4…" for Black's. */
const plyLabel = (ply: number) => (ply % 2 === 1 ? `${(ply + 1) / 2}.` : `${ply / 2}…`);

export function layout(lines: IndexedLine[], stages: Map<string, LineStage>, options: LayoutOptions): Layout {
	const { zoom, opening } = options;
	const here = options.here ?? null;
	const detail = zoom === 'detail';
	const bands = bandsOf(lines, stages);
	const maxPly = Math.max(opening + 1, ...lines.map((l) => l.moves.length));
	const row = options.touch ? TOUCH_ROW[zoom] : ROW[zoom];
	const gutter = detail ? 180 : Math.min(150, Math.round(options.width * 0.36));
	const nameSpace = detail ? 230 : 8;
	const plyW = detail ? 46 : Math.max(6, (options.width - gutter - nameSpace - 16) / (maxPly - opening));
	const x = (ply: number) => gutter + (ply - opening) * plyW;
	const width = Math.max(options.width, x(maxPly) + nameSpace);

	const out: Layout = { width, height: 0, bands: [], edges: [], moves: [], nodes: [], here: null };
	let y = TOP;

	for (const band of bands) {
		const bandHere = here !== null && band.lines.some((l) => isHere(l, here));
		const root = trie(band.lines, opening);
		const leaves = place(root, row, y);
		const height = Math.max(leaves * row, HEAD[zoom]);
		out.bands.push({
			name: band.name,
			label: band.kind === 'variation' ? shortVariation(band.name) : band.name,
			kind: band.kind,
			y,
			height,
			count: `${band.discovered} of ${band.lines.length}`,
			here: bandHere
		});

		const draw = (node: TrieNode, parent: TrieNode | null) => {
			if (parent) {
				const state = edgeState(node, stages, here);
				const x1 = x(parent.ply);
				const x2 = x(node.ply);
				const d =
					parent.y === node.y
						? `M${x1} ${parent.y} H${x2}`
						: `M${x1} ${parent.y} C${x1 + plyW * 0.55} ${parent.y} ${x2 - plyW * 0.55} ${node.y} ${x2} ${node.y}`;
				let label: LayoutEdge['label'] = null;
				// The move is written only where the learner has been: fog and the secret continuation stay unlabelled.
				if (detail && (state === 'lit' || state === 'ember')) {
					const shown = node.lines.find((l) => stages.get(l.key) === 'discovered' || stages.get(l.key) === 'entered' || isHere(l, here));
					// At the landing end, where a curved edge has flattened out, so the move reads as "what lands here".
					if (shown) label = { x: x2 - 3, y: node.y - 5, text: sanOf(shown)[node.ply - 1] };
				}
				out.edges.push({ d, state, label });
				// Where the move lands: a bead unless it is a line's end, which already has a node drawn for
				// it. Ends are still recorded, because the end of a found line is the first thing a reader
				// points at and it would be strange for that one alone to show nothing.
				const known =
					state === 'lit' || state === 'ember'
						? (node.lines.find((l) => stages.get(l.key) === 'discovered' || stages.get(l.key) === 'entered' || isHere(l, here)) ?? null)
						: null;
				out.moves.push({ x: x2, y: node.y, ply: node.ply, state, line: known, end: node.ends.length > 0 });
			}
			for (const child of node.children) draw(child, node);
			if (node.ends.length) {
				const stage = node.ends.some((l) => stages.get(l.key) === 'discovered')
					? 'discovered'
					: node.ends.some((l) => stages.get(l.key) === 'entered' || isHere(l, here))
						? 'entered'
						: null;
				const kind = stage === 'discovered' ? 'lit' : stage === 'entered' ? 'ember' : 'secret';
				// Only an end the learner has reached can be picked up again; the fog stays unclickable,
				// because offering to play a secret line would be handing it over.
				const line =
					stage === 'discovered'
						? node.ends.find((l) => stages.get(l.key) === 'discovered')
						: stage === 'entered'
							? node.ends.find((l) => stages.get(l.key) === 'entered' || isHere(l, here))
							: undefined;
				let label: string | null = null;
				if (detail && stage === 'discovered' && line) {
					label = band.kind === 'variation' ? shortLine(line) : shortVariation(line.name);
				}
				out.nodes.push({ x: x(node.ply), y: node.y, r: stage ? 3.5 : 2.5, kind, label, line });
			} else if (detail && node.children.length > 1) {
				// Branch points are the only structure the fog reveals.
				out.nodes.push({ x: x(node.ply), y: node.y, r: 1.6, kind: 'branch', label: null });
			}
		};
		draw(root, null);

		if (bandHere && here!.index >= opening) {
			let at: TrieNode | undefined = root;
			for (let ply = opening; ply < here!.index && at; ply++) {
				const uci: string = here!.line.moves[ply];
				at = at.children.find((c) => c.uci === uci);
			}
			if (at) out.here = { x: x(at.ply), y: at.y };
		}

		y += height + GAP[zoom];
	}

	out.height = y + 8;
	return out;
}

/** Elements the layout will render, for the performance budget. */
export const elementCount = (l: Layout) =>
	l.bands.length * 3 +
	l.edges.reduce((n, e) => n + 1 + (e.label ? 1 : 0), 0) +
	// Every move bead of one state rides on a single path of zero-length subpaths with round caps, so the
	// beads cost four elements however many moves there are.
	(l.moves.length ? 4 : 0) +
	l.nodes.reduce((n, e) => n + 1 + (e.label ? 1 : 0), 0) +
	(l.here ? 2 : 0);
