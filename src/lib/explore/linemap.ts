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

/**
 * What a position on a line may be *called*. A discovered line may be named; a line only entered is
 * called after its entrance, because its end is still secret; anything else has no name at all.
 *
 * The chart already draws this rule — an entered line ends in a hollow, unnamed ring. The text around it
 * has to obey the same rule, or a tooltip, a screen reader or a tap dialog gives away what the ring was
 * hiding. Nothing outside this file should read `.name` off a line.
 */
function displayName(line: IndexedLine, stage: LineStage | undefined): string {
	if (stage === 'discovered') return line.name;
	if (stage === 'entered') return line.entryName ?? line.variation;
	return '';
}

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
	/**
	 * Bands folded away by name. A collapsed band keeps its header — its name, its tally and its spine —
	 * and draws none of its tree, so the ones still open have the screen to themselves.
	 */
	collapsed?: ReadonlySet<string>;
};

export type LayoutBand = {
	name: string;
	label: string;
	kind: BandKind;
	y: number;
	height: number;
	count: string;
	here: boolean;
	collapsed: boolean;
	/** Lines found, of lines there are — what the header's spine draws when the band is folded. */
	found: number;
	total: number;
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
	/** What to call this position. A band's root is called after the band, never after a line through it. */
	name: string;
	/** Whether to draw a bead here. A line's end and a band's root already have a node of their own. */
	bead: boolean;
};

export type LayoutNode = {
	x: number;
	y: number;
	r: number;
	kind: 'lit' | 'ember' | 'secret' | 'branch';
	label: string | null;
	/** The line this end completes, when it is one the learner has been down and may pick up again. */
	line?: IndexedLine;
	/**
	 * How far along `line` picking it up replays. A found line replays whole; a line only *entered*
	 * replays to its entrance and no further, because everything past that is still secret — replaying
	 * it would hand over the moves the learner came here to find.
	 */
	resumeTo?: number;
	/** What this end may be called — never the raw line name. See `displayName`. */
	name: string;
};

export type Layout = {
	width: number;
	height: number;
	/** Where the first move's column starts. Left of it is the band labels' own space, and nothing else. */
	gutter: number;
	bands: LayoutBand[];
	edges: LayoutEdge[];
	moves: LayoutMove[];
	nodes: LayoutNode[];
	here: { x: number; y: number } | null;
};

// Rows are far enough apart that a node's hit area cannot reach the row above or below it.
const ROW: Record<Zoom, number> = { detail: 20, overview: 7 };
const TOUCH_ROW: Record<Zoom, number> = { detail: 32, overview: 12 };
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
	const isFolded = (name: string) => options.collapsed?.has(name) ?? false;
	/**
	 * How wide the chart has to be is decided by the deepest line still drawn. A folded band pays for no
	 * width, so folding everything leaves a narrow column of headers rather than a wide one with its
	 * labels shrunk to fit a tree nobody is looking at.
	 */
	const drawn = bands.filter((b) => !isFolded(b.name));
	const maxPly = Math.max(opening + 1, ...drawn.flatMap((b) => b.lines.map((l) => l.moves.length)));
	const row = options.touch ? TOUCH_ROW[zoom] : ROW[zoom];
	const gutter = detail ? 180 : Math.min(150, Math.round(options.width * 0.36));
	const nameSpace = detail ? 230 : 8;
	const plyW = detail ? 46 : Math.max(6, (options.width - gutter - nameSpace - 16) / (maxPly - opening));
	const x = (ply: number) => gutter + (ply - opening) * plyW;
	const width = Math.max(options.width, x(maxPly) + nameSpace);

	const out: Layout = { width, height: 0, gutter, bands: [], edges: [], moves: [], nodes: [], here: null };
	let y = TOP;

	for (const band of bands) {
		const bandHere = here !== null && band.lines.some((l) => isHere(l, here));
		const folded = isFolded(band.name);
		const root = trie(band.lines, opening);
		const leaves = place(root, row, y);
		const height = folded ? HEAD[zoom] : Math.max(leaves * row, HEAD[zoom]);
		out.bands.push({
			name: band.name,
			label: band.kind === 'variation' ? shortVariation(band.name) : band.name,
			kind: band.kind,
			y,
			height,
			count: `${band.discovered} of ${band.lines.length}`,
			here: bandHere,
			collapsed: folded,
			found: band.discovered,
			total: band.lines.length
		});

		// Folded: the header is the whole band. Nothing below it is drawn, so nothing below it can be
		// hovered, picked or counted against the element budget.
		if (folded) {
			y += height + GAP[zoom];
			continue;
		}

		// The first node of a band is the opening's own position. It is drawn, so it is hoverable — and the
		// defining moves are never secret, so it can always show what it is.
		out.moves.push({
			x: x(opening),
			y: root.y,
			ply: opening,
			state: 'fog',
			line: band.lines[0],
			// The band's own name. Any line through the root would do for the diagram, but naming one would
			// hand over a line the learner has not found.
			name: band.kind === 'variation' ? shortVariation(band.name) : band.name,
			bead: false
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
				out.moves.push({
					x: x2,
					y: node.y,
					ply: node.ply,
					state,
					line: known,
					name: known ? displayName(known, stages.get(known.key)) : '',
					bead: node.ends.length === 0
				});
			}
			for (const child of node.children) draw(child, node);
			if (node.ends.length) {
				// Warm because the game is passing through is not the same as warm because the line was
				// entered. Only what the stages record can be picked up: before its entrance, a line the game
				// merely runs through has been earned no part of, and offering it would play its moves.
				const earned = node.ends.find((l) => stages.get(l.key) === 'discovered')
					? 'discovered'
					: node.ends.find((l) => stages.get(l.key) === 'entered')
						? 'entered'
						: null;
				const stage = earned ?? (node.ends.some((l) => isHere(l, here)) ? 'entered' : null);
				const kind = stage === 'discovered' ? 'lit' : stage === 'entered' ? 'ember' : 'secret';
				const line = earned ? node.ends.find((l) => stages.get(l.key) === earned) : undefined;
				let label: string | null = null;
				if (detail && stage === 'discovered' && line) {
					label = band.kind === 'variation' ? shortLine(line) : shortVariation(line.name);
				}
				const resumeTo = line ? (earned === 'discovered' ? line.moves.length : entranceOf(line)) : undefined;
				out.nodes.push({
					x: x(node.ply),
					y: node.y,
					r: stage ? 3.5 : 2.5,
					kind,
					label,
					line,
					resumeTo,
					name: line ? displayName(line, earned ?? undefined) : ''
				});
			} else if (detail && node.children.length > 1) {
				// Branch points are the only structure the fog reveals.
				out.nodes.push({ x: x(node.ply), y: node.y, r: 1.6, kind: 'branch', label: null, name: '' });
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

// ── Zoom ─────────────────────────────────────────────────────────────────────
// The chart is laid out once, for the panel's width, and zooming only scales what is drawn. The layout
// never changes, so the tree keeps its shape and nothing reflows under the fingers.

/** As far in as a pinch may go. Past this the beads are further apart than they are informative. */
export const MAX_SCALE = 3;
/** However tall the chart, it never shrinks past this: an overview, not a smudge. */
export const FLOOR_SCALE = 0.06;

export type ScaleBounds = { min: number; fit: number };

/**
 * `fit` is where the map opens: the whole breadth of the opening, which is the axis that carries meaning,
 * and as much of the height as that leaves. `min` is as far out as a pinch may go — exactly far enough to
 * put the entire chart in the frame, so "show me everything" is always one gesture away and never
 * overshoots into nothing.
 */
export function scaleBounds(frame: { width: number; height: number }, chart: { width: number; height: number }): ScaleBounds {
	if (!frame.width || !frame.height || !chart.width || !chart.height) return { min: FLOOR_SCALE, fit: 1 };
	const min = Math.max(FLOOR_SCALE, Math.min(1, frame.width / chart.width, frame.height / chart.height));
	return { min, fit: Math.max(min, Math.min(1, frame.width / chart.width)) };
}

export const clampScale = (n: number, bounds: ScaleBounds) => Math.min(MAX_SCALE, Math.max(bounds.min, n));

/**
 * When the chart is narrower than its frame it sits in the middle of it, and that offset is part of every
 * sum below. It must come from a margin on the chart rather than from centring the scroller's content:
 * a flex container that centres something wider than itself splits the overflow to both sides, and the
 * left half of it cannot be scrolled to at all.
 */
export const centerOffset = (frame: number, drawn: number) => Math.max(0, (frame - drawn) / 2);

/** The chart point under (px, py), which is given in the scroller's own client box. */
export function contentPoint(o: {
	scrollLeft: number;
	scrollTop: number;
	px: number;
	py: number;
	scale: number;
	frameWidth: number;
	chartWidth: number;
}) {
	return {
		x: (o.scrollLeft + o.px - centerOffset(o.frameWidth, o.chartWidth * o.scale)) / o.scale,
		y: (o.scrollTop + o.py) / o.scale
	};
}

/**
 * Where to leave the scroller so that `anchor` — a point in chart coordinates — lands under (px, py) at
 * the given scale. Holding one chart point for a whole pinch, rather than re-deriving it from the last
 * frame's scroll offset, is what stops the error compounding across a gesture's hundred events.
 *
 * Negative or over-long values are what the browser would clamp to the ends anyway; clamping here as
 * well keeps the function's answer the same as the scroller's.
 */
export function scrollFor(o: {
	anchor: { x: number; y: number };
	px: number;
	py: number;
	scale: number;
	frame: { width: number; height: number };
	chart: { width: number; height: number };
}) {
	const drawnWidth = o.chart.width * o.scale;
	const drawnHeight = o.chart.height * o.scale;
	const bound = (n: number, drawn: number, frame: number) => Math.min(Math.max(0, n), Math.max(0, drawn - frame));
	return {
		left: bound(o.anchor.x * o.scale + centerOffset(o.frame.width, drawnWidth) - o.px, drawnWidth, o.frame.width),
		top: bound(o.anchor.y * o.scale - o.py, drawnHeight, o.frame.height)
	};
}

/**
 * Where the map opens. A phone shows four per cent of the chart at scale 1, so it opens fitted to the
 * width — the full breadth of the opening, and most of its height. A desktop window already holds enough
 * of the chart to read it, and fitting there only made it smaller than it needed to be, so it opens at
 * its natural size and zoom is something the reader asks for.
 */
export const openingScale = (bounds: ScaleBounds, touch: boolean) => (touch ? bounds.fit : clampScale(1, bounds));

// ── The throw ────────────────────────────────────────────────────────────────
// Letting go of a map mid-drag should keep it moving and let friction stop it, rather than making the
// reader drag every pixel of a chart four screens tall.

/** A pointer position in time, as the pan records them while a drag is running. */
export type Track = { x: number; y: number; t: number };

/**
 * Only the last stretch of a drag decides the throw. A long slow drag that ends in a flick should fly;
 * one that ends stationary should stop dead, and it will, because nothing moved inside the window.
 */
export const FLICK_WINDOW_MS = 90;
/** Velocity decays by `e` every this long. Distance thrown is `speed × TAU`, so a fast flick ≈ 600px. */
export const GLIDE_TAU_MS = 325;
/** px/ms. Below this a drag was a placement, not a throw, and the map stays where it was put. */
export const FLICK_MIN = 0.12;
/** px/ms. Below this the glide has visually stopped; carrying on just burns frames. */
export const GLIDE_STOP = 0.015;

/** How fast the pointer was travelling when it left, from the last `window` of movement only. */
export function flickVelocity(track: readonly Track[], window = FLICK_WINDOW_MS): { x: number; y: number } {
	if (track.length < 2) return { x: 0, y: 0 };
	const last = track[track.length - 1];
	let first = track[0];
	for (let i = track.length - 1; i >= 0; i--) {
		first = track[i];
		if (last.t - track[i].t >= window) break;
	}
	const dt = last.t - first.t;
	if (dt <= 0) return { x: 0, y: 0 };
	return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
}

/**
 * One frame of the glide: how far it travels, and what is left of the velocity afterwards.
 *
 * `moved` is the integral of the decaying velocity across the frame rather than `velocity × dt`, so the
 * same throw covers the same distance at 60Hz and at 120Hz, and a frame the browser drops does not
 * shorten it.
 */
export function glideStep(velocity: number, dt: number, tau = GLIDE_TAU_MS) {
	const decay = Math.exp(-dt / tau);
	return { moved: velocity * tau * (1 - decay), velocity: velocity * decay };
}

/** Whether a throw is worth starting at all. */
export const isFlick = (v: { x: number; y: number }) => Math.hypot(v.x, v.y) >= FLICK_MIN;
