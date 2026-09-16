import { describe, expect, it } from 'vitest';
import { importedSprite, IMPORTED_SETS, paletteFor, type ImportedSet } from './imported';

/** Every `fill:`/`stroke:` value inside one set's symbols for one piece colour. */
async function paintedIn(set: ImportedSet, color: 'w' | 'b'): Promise<Set<string>> {
	const sprite = await importedSprite(set);
	const symbols = sprite.split('<symbol ').filter((part) => part.startsWith(`id="lp-${set}-${color}`));
	expect(symbols).toHaveLength(6);
	const used = new Set<string>();
	for (const symbol of symbols) {
		for (const [, value] of symbol.matchAll(/(?:fill|stroke):([^;"]+)/g)) used.add(value.trim());
	}
	return used;
}

describe('imported piece sets', () => {
	// The bug this guards: Cburnett's black outline used to be a blend of the body and the edge token,
	// which collapsed onto the body in most themes but became a visible third tone wherever the edge is
	// light (Night, Graphite). Only the pieces carrying interior detail showed it, so the black side of
	// the board came out in three colours while the pawn stayed in two.
	for (const set of IMPORTED_SETS) {
		for (const color of ['w', 'b'] as const) {
			it(`paints a ${color === 'b' ? 'black' : 'white'} ${set} piece in two colours and no more`, async () => {
				const { body, line } = paletteFor(set, color);
				const used = paintedIn(set, color);
				expect([...(await used)].filter((value) => value !== 'none').sort()).toEqual([body, line].sort());
			});
		}
	}

	it('gives a black piece a dark body and a light line, and a white piece the reverse', async () => {
		for (const set of IMPORTED_SETS) {
			expect(paletteFor(set, 'b').body).toBe('var(--pb2)');
			expect(paletteFor(set, 'b').line).toContain('--pbh');
			expect(paletteFor(set, 'w').body).toBe('var(--pw1)');
			expect(paletteFor(set, 'w').line).toBe('var(--pws)');
		}
	});
});
