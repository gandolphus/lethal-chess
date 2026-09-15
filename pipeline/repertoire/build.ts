// Builds a per-opening drill bundle from the eval cache and the opening catalog.
//
//   node pipeline/repertoire/build.ts [repertoire-id ...]     (default: all launch repertoires)
//
// Expansion is best-first by path weight: the likelier a position is to arise
// in a drill, the earlier it is expanded, so main lines run deep and sidelines
// stay shallow within a fixed card budget.
//
// Learner-to-move: exactly one move — the catalogued theory move when one is
// within `soundCp` of the engine's best (preferring the one with the most theory
// behind it), otherwise the engine's best.
// Opponent-to-move: every engine candidate within `replyCp` of best, plus every
// catalogued reply (named lines include dubious-but-real moves worth punishing).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import type { BookLine, Bundle, BundleNode, Candidate, OpeningIndexEntry, Reply, Side } from '../../src/lib/drill/bundle.ts';
import { scoreFor } from '../../src/lib/drill/bundle.ts';
import { winChance } from '../../src/lib/coach/judge.ts';
import { toEpd } from '../lib/codec.ts';
import { normalizeCastling } from '../lib/uci.ts';
import type { EvalRecord } from '../eval-cache/format.ts';
import { buildCatalogIndex, type CatalogIndex, type CatalogLine } from './catalog-index.ts';
import { LAUNCH_REPERTOIRES, type RepertoireSpec } from './spec.ts';

export type EvalSource = (epd: string) => EvalRecord | null;

type Frontier = { fen: string; weight: number };

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function play(fen: string, uci: string): Chess {
	const chess = new Chess(fen);
	chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
	return chess;
}

/** Engine candidates with castling normalised, SAN attached, illegal entries dropped. */
function candidatesAt(fen: string, record: EvalRecord): { candidates: Candidate[]; line: string[] } {
	const chess = new Chess(fen);
	const candidates: Candidate[] = [];
	for (const pv of record.pvs) {
		const uci = normalizeCastling(chess, pv.move);
		// The eval db sometimes repeats a PV verbatim (pv2 = pv3); a duplicate would
		// make sharpness compare a move with itself and weaken the unknown-move bound.
		if (candidates.some((c) => c.uci === uci)) continue;
		try {
			candidates.push({ uci, san: play(fen, uci).history().at(-1)!, score: pv.score });
		} catch {
			// A cached move that isn't legal here would mean a hash collision; skip it rather than ship it.
		}
	}

	const line: string[] = [];
	const walker = new Chess(fen);
	for (const raw of record.line) {
		const uci = normalizeCastling(walker, raw);
		try {
			line.push(walker.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san);
		} catch {
			break;
		}
	}
	return { candidates, line };
}

// Mate scores map to ±100,000 in scoreFor, so a mate-vs-centipawn gap would read as
// ~100,000 cp. Beyond a queen's worth the number stops meaning anything more anyway.
const SHARPNESS_CAP = 1000;

export function sharpness(candidates: Candidate[], side: Side): number | undefined {
	if (candidates.length < 2) return undefined;
	const gap = scoreFor(candidates[0].score, side) - scoreFor(candidates[1].score, side);
	return Math.min(SHARPNESS_CAP, Math.max(0, gap));
}

function chooseLearnerMove(
	candidates: Candidate[],
	theory: ReturnType<CatalogIndex['children']>,
	side: Side,
	soundCp: number
): Candidate {
	const best = scoreFor(candidates[0].score, side);
	const soundTheory = candidates
		.filter((c) => best - scoreFor(c.score, side) <= soundCp)
		.map((c) => ({ candidate: c, lines: theory.find((t) => t.uci === c.uci)?.lines ?? 0 }))
		.filter((t) => t.lines > 0)
		.sort((a, b) => b.lines - a.lines || scoreFor(b.candidate.score, side) - scoreFor(a.candidate.score, side));
	return soundTheory[0]?.candidate ?? candidates[0];
}

export function chooseReplies(
	fen: string,
	candidates: Candidate[],
	theory: ReturnType<CatalogIndex['children']>,
	mover: Side,
	replyCp: number,
	maxReplies: number
): Reply[] {
	const best = scoreFor(candidates[0].score, mover);
	// Theory adds weight but is capped below an engine rank, so a family of named
	// lines can promote a sound reply without letting one thin line outrank it.
	const theoryWeight = (lines: number) => Math.min(1, Math.log2(1 + lines) / 6);

	// Every sound engine reply gets a seat first, best first…
	const seated = candidates
		.map((c, rank) => ({ c, rank }))
		.filter(({ c }) => best - scoreFor(c.score, mover) <= replyCp)
		.slice(0, maxReplies)
		.map(({ c, rank }) => ({
			uci: c.uci,
			san: c.san,
			score: 1 / (rank + 1) + theoryWeight(theory.find((t) => t.uci === c.uci)?.lines ?? 0)
		}));

	// …then catalogued-but-unsound replies fill any remaining seats, most theory first.
	const theoryOnly = theory
		.filter((t) => !seated.some((s) => s.uci === t.uci))
		.sort((a, b) => b.lines - a.lines)
		.slice(0, Math.max(0, maxReplies - seated.length))
		.map((t) => ({ uci: t.uci, san: play(fen, t.uci).history().at(-1)!, score: theoryWeight(t.lines) }));

	const replies = [...seated, ...theoryOnly];
	const total = replies.reduce((sum, r) => sum + r.score, 0);
	return replies.map(({ uci, san, score }) => ({ uci, san, weight: score / total }));
}

/**
 * Makes every drilled reply lead to a learner decision. Expansion stops at the card
 * budget, which leaves replies pointing at positions that were never expanded; a
 * drill following one would end the moment the opponent moves, asking nothing.
 * Such replies are dropped (weights renormalised), opponent nodes left without
 * replies become line ends, and nodes no longer reachable are removed.
 */
export function pruneDanglingReplies(nodes: Record<string, BundleNode>, rootEpd: string): void {
	for (const node of Object.values(nodes)) {
		if (!node.replies) continue;
		const live = node.replies.filter((r) => nodes[epdAfter(node.epd, r.uci)]?.move);
		const total = live.reduce((sum, r) => sum + r.weight, 0);
		if (live.length) node.replies = live.map((r) => ({ ...r, weight: r.weight / total }));
		else delete node.replies;
	}

	const reachable = new Set<string>();
	const queue = [rootEpd];
	while (queue.length) {
		const epd = queue.pop()!;
		const node = nodes[epd];
		if (!node || reachable.has(epd)) continue;
		reachable.add(epd);
		if (node.move) queue.push(epdAfter(epd, node.move.uci));
		for (const reply of node.replies ?? []) queue.push(epdAfter(epd, reply.uci));
	}
	for (const epd of Object.keys(nodes)) if (!reachable.has(epd)) delete nodes[epd];
}

const epdAfter = (epd: string, uci: string) => toEpd(play(`${epd} 0 1`, uci).fen());

/**
 * Removes repetition cycles. Nodes are keyed by position, so a line that shuffles pieces back to an
 * earlier position links back to that node — and a walk following it never ends. Every edge into a
 * position already on the current path is dropped: a reply is removed (weights renormalised), a
 * learner move ends the line there. Run before pruneDanglingReplies, which tidies what this leaves.
 */
export function breakCycles(nodes: Record<string, BundleNode>, rootEpd: string): void {
	const onPath = new Set<string>();
	const done = new Set<string>();
	const visit = (epd: string) => {
		const node = nodes[epd];
		if (!node || done.has(epd)) return;
		onPath.add(epd);
		if (node.move) {
			const next = epdAfter(epd, node.move.uci);
			if (onPath.has(next)) delete node.move;
			else visit(next);
		}
		if (node.replies) {
			const kept = node.replies.filter((r) => !onPath.has(epdAfter(epd, r.uci)));
			const total = kept.reduce((sum, r) => sum + r.weight, 0);
			if (kept.length) node.replies = kept.map((r) => ({ ...r, weight: r.weight / total }));
			else delete node.replies;
			for (const reply of node.replies ?? []) visit(epdAfter(epd, reply.uci));
		}
		onPath.delete(epd);
		done.add(epd);
	};
	visit(rootEpd);
}

/**
 * Nodes for the moves that define the opening (e.g. 1.e4 e5 2.Nf3 Nc6 3.Bb5 for the Ruy Lopez), from
 * the initial position to the tree's root. At the learner's turns the move is the defining move —
 * even when the engine prefers another, since that move *is* the opening; an engine-preferred
 * alternative still grades as sound-but-not-your-line. At the opponent's turns the defining move is
 * the only reply.
 */
export function addPrelude(
	spec: RepertoireSpec,
	nodes: Record<string, BundleNode>,
	evals: EvalSource,
	catalog: CatalogIndex,
	stats: { missingEvals: number }
): void {
	let fen = START_FEN;
	spec.rootMoves.forEach((uci, ply) => {
		const epd = toEpd(fen);
		const after = play(fen, uci);
		const san = after.history().at(-1)!;
		const record = evals(epd);
		if (!record) stats.missingEvals++;
		const { candidates, line } = record ? candidatesAt(fen, record) : { candidates: [], line: [] };
		const toMove = fen.split(' ')[1] as Side;

		// The defining move's own score: from this position's candidates, or else the best score
		// available in the position it leads to (which is that move's evaluation).
		let chosen = candidates.find((c) => c.uci === uci);
		if (!chosen) {
			const next = evals(toEpd(after.fen()));
			chosen = { uci, san, score: next?.pvs[0]?.score ?? { cp: 0 } };
			candidates.push(chosen);
			candidates.sort((a, b) => scoreFor(b.score, toMove) - scoreFor(a.score, toMove));
		}

		if (nodes[epd]) throw new Error(`${spec.id}: prelude position already in the tree: ${epd}`);
		nodes[epd] = {
			epd,
			ply,
			name: catalog.name(epd),
			depth: record?.depth ?? 0,
			candidates,
			line,
			sharpness: sharpness(candidates, toMove),
			...(toMove === spec.side ? { move: chosen } : { replies: [{ uci, san, weight: 1 }] })
		};
		fen = after.fen();
	});
}

// A line is dubious when following it takes a learner move the coach would call a mistake.
const DUBIOUS_LOSS = 0.2;

/**
 * The established lines an explorer can discover: every catalog line that continues the opening's
 * defining moves and has no catalogued continuation of its own (its end is where theory stops).
 * A line's entrance is the deepest named position before its end, past the defining moves: from
 * there the line has a name to follow. A line with no such position is entered at its end.
 * Every position on a line gets a node (evals, name), so book moves grade without the engine.
 */
export function buildLines(
	spec: RepertoireSpec,
	catalogLines: CatalogLine[],
	nodes: Record<string, BundleNode>,
	evals: EvalSource,
	catalog: CatalogIndex,
	stats: { bookNodes: number; missingBookEvals: number }
): BookLine[] {
	const root = spec.rootMoves.join(' ');
	const under = catalogLines.filter((l) => l.uci.startsWith(`${root} `));
	const prefixes = new Set(under.flatMap((l) => l.uci.split(' ').slice(0, -1).map((_, i, all) => all.slice(0, i + 1).join(' '))));
	const leaves = under.filter((l) => !prefixes.has(l.uci));
	// The catalog repeats the opening's own name on later positions ("Caro-Kann Defense" after 2.d4 too);
	// that says nothing about which line the learner is in, so it is no entrance.
	const openingName = catalog.name(epdAfterMoves(spec.rootMoves));

	const nodeAt = (fen: string, ply: number): BundleNode | undefined => {
		const epd = toEpd(fen);
		if (nodes[epd]) return nodes[epd];
		const record = evals(epd);
		if (!record) {
			stats.missingBookEvals++;
			return undefined;
		}
		const { candidates, line } = candidatesAt(fen, record);
		if (!candidates.length) return undefined;
		stats.bookNodes++;
		return (nodes[epd] = {
			epd,
			ply,
			name: catalog.name(epd),
			depth: record.depth,
			candidates,
			line,
			sharpness: sharpness(candidates, fen.split(' ')[1] as Side)
		});
	};

	return leaves.map((leaf) => {
		const moves = leaf.uci.split(' ');
		const chess = new Chess();
		let entry = moves.length;
		let dubious = false;
		moves.forEach((uci, ply) => {
			const fen = chess.fen();
			const before = nodeAt(fen, ply);
			const mover = fen.split(' ')[1] as Side;
			chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
			const after = nodeAt(chess.fen(), ply + 1);
			if (ply >= spec.rootMoves.length && mover === spec.side && before) {
				const played = before.candidates.find((c) => c.uci === uci)?.score ?? after?.candidates[0]?.score;
				if (played && winChance(before.candidates[0].score, mover) - winChance(played, mover) >= DUBIOUS_LOSS) dubious = true;
			}
			const name = catalog.name(toEpd(chess.fen()));
			if (ply + 1 > spec.rootMoves.length && ply + 1 < moves.length && name && name !== openingName) entry = ply + 1;
		});
		const entryName = entry < moves.length ? catalog.name(epdAfterMoves(moves.slice(0, entry))) : undefined;
		return {
			name: leaf.name,
			variation: leaf.name.split(',')[0],
			moves,
			entry,
			...(entryName ? { entryName } : {}),
			dubious
		};
	});
}

const epdAfterMoves = (moves: string[]) => toEpd(moves.reduce((fen, uci) => play(fen, uci).fen(), START_FEN));

export function buildRepertoire(
	spec: RepertoireSpec,
	evals: EvalSource,
	catalog: CatalogIndex,
	evalCacheRecords = 0,
	catalogLines: CatalogLine[] = []
): Bundle {
	const rootFen = spec.rootMoves.reduce((fen, uci) => play(fen, uci).fen(), START_FEN);
	const rootEpd = toEpd(rootFen);
	const nodes: Record<string, BundleNode> = {};
	const stats = { learnerNodes: 0, opponentNodes: 0, maxPly: 0, missingEvals: 0 };

	const frontier: Frontier[] = [{ fen: rootFen, weight: 1 }];
	const plyOf = (fen: string) => (Number(fen.split(' ')[5]) - 1) * 2 + (fen.split(' ')[1] === 'b' ? 1 : 0);

	while (frontier.length && stats.learnerNodes < spec.learnerBudget) {
		frontier.sort((a, b) => b.weight - a.weight);
		const { fen, weight } = frontier.shift()!;
		const epd = toEpd(fen);
		if (nodes[epd]) continue; // transposition into an already-expanded position

		const ply = plyOf(fen);
		const record = evals(epd);
		if (!record) {
			stats.missingEvals++;
			continue;
		}

		const toMove = fen.split(' ')[1] as Side;
		const { candidates, line } = candidatesAt(fen, record);
		if (!candidates.length) continue;

		const node: BundleNode = {
			epd,
			ply,
			name: catalog.name(epd),
			depth: record.depth,
			candidates,
			line,
			sharpness: sharpness(candidates, toMove)
		};
		nodes[epd] = node;
		stats.maxPly = Math.max(stats.maxPly, ply);
		if (ply >= spec.maxPly) continue; // recorded for grading, not expanded

		const theory = catalog.children(epd);
		if (toMove === spec.side) {
			node.move = chooseLearnerMove(candidates, theory, toMove, spec.soundCp);
			stats.learnerNodes++;
			frontier.push({ fen: play(fen, node.move.uci).fen(), weight });
		} else {
			node.replies = chooseReplies(fen, candidates, theory, toMove, spec.replyCp, spec.maxReplies);
			stats.opponentNodes++;
			for (const reply of node.replies) {
				frontier.push({ fen: play(fen, reply.uci).fen(), weight: weight * reply.weight });
			}
		}
	}

	breakCycles(nodes, rootEpd);
	pruneDanglingReplies(nodes, rootEpd);
	// Walks start from the initial position, not the opening's defining position, so the
	// learner also practises the moves that lead into it.
	addPrelude(spec, nodes, evals, catalog, stats);
	const final = Object.values(nodes);
	stats.learnerNodes = final.filter((n) => n.move).length;
	stats.opponentNodes = final.filter((n) => n.replies).length;
	stats.maxPly = Math.max(0, ...final.map((n) => n.ply));
	const bookStats = { bookNodes: 0, missingBookEvals: 0 };
	const lines = buildLines(spec, catalogLines, nodes, evals, catalog, bookStats);

	return {
		id: spec.id,
		name: spec.name,
		side: spec.side,
		rootMoves: [],
		rootEpd: toEpd(START_FEN),
		openingMoves: spec.rootMoves,
		nodes,
		lines,
		tolerances: { soundCp: spec.soundCp, replyCp: spec.replyCp },
		stats: { ...stats, ...bookStats },
		source: { evalCacheRecords, builtAt: new Date().toISOString() }
	};
}

if (import.meta.main) {
	const { EvalCache } = await import('../eval-cache/reader.ts');
	const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
	const cache = new EvalCache(join(root, 'data', 'cache', 'evals'));
	const { lines } = JSON.parse(readFileSync(join(root, 'static', 'openings', 'catalog.json'), 'utf8')) as {
		lines: CatalogLine[];
	};
	const catalog = buildCatalogIndex(lines);
	const wanted = process.argv.slice(2);
	const specs = wanted.length ? LAUNCH_REPERTOIRES.filter((s) => wanted.includes(s.id)) : LAUNCH_REPERTOIRES;
	const outDir = join(root, 'static', 'openings', 'repertoires');
	mkdirSync(outDir, { recursive: true });

	const index: OpeningIndexEntry[] = [];
	for (const spec of specs) {
		const started = performance.now();
		const bundle = buildRepertoire(spec, (epd) => cache.get(epd), catalog, cache.size, lines);
		const json = JSON.stringify(bundle);
		writeFileSync(join(outDir, `${spec.id}.json`), json);
		index.push(indexEntry(spec, bundle, json.length));
		const { learnerNodes, opponentNodes, maxPly, missingEvals, bookNodes, missingBookEvals } = bundle.stats;
		console.log(
			`${spec.id}: ${learnerNodes} learner + ${opponentNodes} opponent nodes, max ply ${maxPly}, ` +
				`${missingEvals} missing evals, ${bundle.lines?.length} lines (${bundle.lines?.filter((l) => l.dubious).length} dubious), ` +
				`${bookNodes} book nodes, ${missingBookEvals} missing book evals, ` +
				`${(json.length / 1024).toFixed(0)} KB, ${((performance.now() - started) / 1000).toFixed(1)}s`
		);
	}
	cache.close();

	// A partial rebuild must not drop the other openings from the index.
	const indexPath = join(outDir, 'index.json');
	const previous: OpeningIndexEntry[] = wanted.length ? JSON.parse(readFileSync(indexPath, 'utf8')) : [];
	const merged = LAUNCH_REPERTOIRES.map(
		(spec) => index.find((e) => e.id === spec.id) ?? previous.find((e) => e.id === spec.id)
	).filter((e): e is OpeningIndexEntry => Boolean(e));
	writeFileSync(indexPath, JSON.stringify(merged, null, 2));
	console.log(`index: ${merged.length} openings`);
}

export function indexEntry(spec: RepertoireSpec, bundle: Bundle, bytes: number): OpeningIndexEntry {
	const chess = new Chess();
	for (const uci of spec.rootMoves) chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
	const moves = chess
		.history()
		.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}.${san}` : san))
		.join(' ');

	const opponent = spec.side === 'w' ? 'b' : 'w';
	// Capped per position so one forced mate can't define a whole opening's character.
	const OPENING_SHARPNESS_CAP = 300;
	const sharpness = Object.values(bundle.nodes)
		.filter((n) => n.replies && n.epd.split(' ')[1] === opponent && n.sharpness !== undefined)
		.map((n) => Math.min(OPENING_SHARPNESS_CAP, n.sharpness!));

	return {
		id: spec.id,
		name: spec.name,
		side: spec.side,
		group: spec.group,
		tags: spec.tags,
		moves,
		learnerNodes: bundle.stats.learnerNodes,
		maxPly: bundle.stats.maxPly,
		opponentSharpness: sharpness.length ? Math.round(sharpness.reduce((a, b) => a + b, 0) / sharpness.length) : null,
		lines: (bundle.lines ?? []).filter((l) => !l.dubious).length,
		dubiousLines: (bundle.lines ?? []).filter((l) => l.dubious).map((l) => epdAfterMoves(l.moves)),
		bytes
	};
}
