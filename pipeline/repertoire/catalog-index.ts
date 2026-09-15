// Position-keyed index over the opening catalog: which named moves leave each
// position, how much catalogued theory lies behind each, and which positions are named.

import { Chess } from 'chess.js';
import { toEpd } from '../lib/codec.ts';

export type CatalogLine = { eco: string; name: string; pgn: string; uci: string; epd: string };

export type CatalogChild = {
	uci: string;
	epd: string;
	/** Number of catalog lines passing through this move — a proxy for how much theory it carries. */
	lines: number;
};

export type CatalogIndex = {
	children(epd: string): CatalogChild[];
	name(epd: string): string | undefined;
};

export function buildCatalogIndex(lines: CatalogLine[]): CatalogIndex {
	const children = new Map<string, Map<string, CatalogChild>>();
	const names = new Map<string, string>();

	for (const line of lines) {
		const chess = new Chess();
		let parent = toEpd(chess.fen());
		for (const uci of line.uci.split(' ')) {
			chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
			const epd = toEpd(chess.fen());
			const siblings = children.get(parent) ?? new Map<string, CatalogChild>();
			const child = siblings.get(uci) ?? { uci, epd, lines: 0 };
			child.lines++;
			siblings.set(uci, child);
			children.set(parent, siblings);
			parent = epd;
		}
		// The catalog has no terminal collisions (verified at build), so each name is unambiguous.
		names.set(line.epd, line.name);
	}

	return {
		children: (epd) => [...(children.get(epd)?.values() ?? [])],
		name: (epd) => names.get(epd)
	};
}
