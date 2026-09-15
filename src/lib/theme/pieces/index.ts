// SVG piece sets are sprites of <symbol>s injected once into the document, so
// the gradients and filters they reference by url(#…) resolve in every browser,
// and pieces render as <use href="#lp-<set>-<colour><Type>">.

import { CUSTOM_SETS, customSprite, type CustomSet } from './custom';
import { IMPORTED_SETS, importedSprite, type ImportedSet } from './imported';

export type SvgSet = CustomSet | ImportedSet;

const loaders: Record<SvgSet, () => string | Promise<string>> = {
	monolith: () => customSprite('monolith'),
	material: () => customSprite('material'),
	instrument: () => customSprite('instrument'),
	nocturne: () => customSprite('nocturne'),
	regalia: () => customSprite('regalia'),
	chessnut: () => importedSprite('chessnut'),
	cburnett: () => importedSprite('cburnett')
};

export const isSvgSet = (set: string): set is SvgSet => set in CUSTOM_SETS || (IMPORTED_SETS as readonly string[]).includes(set);

const injected = new Set<string>();

/** Adds the set's sprite to the document the first time it is needed (no-op on the server). */
export function ensurePieceSprite(set: string): void {
	if (typeof document === 'undefined' || injected.has(set) || !isSvgSet(set)) return;
	injected.add(set);
	Promise.resolve(loaders[set]()).then((markup) => {
		const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		sprite.setAttribute('aria-hidden', 'true');
		sprite.dataset.pieceSet = set;
		sprite.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
		sprite.innerHTML = markup;
		document.body.append(sprite);
	});
}

/** `lit: false` picks the variant without per-piece lighting filters, for pieces that move every frame. */
export function symbolId(set: string, color: 'w' | 'b', type: string, lit = true): string {
	return `lp-${set}-${color}${type.toUpperCase()}${set === 'material' && !lit ? '-flat' : ''}`;
}
