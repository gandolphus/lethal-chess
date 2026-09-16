import { describe, expect, it } from 'vitest';
import { FAMILIES, THEMES, familyOf, fromSearch, fromStored, themeFor } from './settings.svelte';

describe('theme families', () => {
	it('resolve to a distinct palette in both modes', () => {
		const seen = new Set<string>();
		for (const family of FAMILIES) {
			for (const mode of ['dark', 'light'] as const) {
				const theme = themeFor(family.id, mode);
				expect(theme.id).toBe(family[mode]);
				expect(theme.mode).toBe(mode);
				expect(theme.board).toBe(family.board);
				expect(seen.has(theme.id)).toBe(false);
				seen.add(theme.id);
			}
		}
		expect(seen.size).toBe(THEMES.length);
	});

	it('know which family and side every palette is', () => {
		expect(familyOf('night')).toMatchObject({ family: { id: 'nocturne' }, mode: 'dark' });
		expect(familyOf('sage')).toMatchObject({ family: { id: 'grove' }, mode: 'light' });
		expect(familyOf('nope')).toBeNull();
		expect(familyOf(undefined)).toBeNull();
	});

	it('fall back to the first family for an unknown id', () => {
		expect(themeFor('nope', 'light').id).toBe('gallery');
	});
});

describe('stored appearance', () => {
	it('maps a record from before families onto a family and a mode', () => {
		expect(fromStored({ theme: 'night', pieceSet: 'nocturne', font: 'geometric' })).toEqual({
			family: 'nocturne',
			mode: 'dark',
			pieceSet: 'nocturne',
			font: 'geometric'
		});
		expect(fromStored({ theme: 'paper' })).toEqual({ family: 'timber', mode: 'light' });
	});

	it('keeps a family record as it is', () => {
		expect(fromStored({ family: 'tide', mode: 'light', pieceSet: 'glyph', font: 'system' })).toEqual({
			family: 'tide',
			mode: 'light',
			pieceSet: 'glyph',
			font: 'system'
		});
	});

	it('drops what it does not know without throwing', () => {
		expect(fromStored({ theme: 'nope', family: 'nope', mode: 'dim', pieceSet: 'nope', font: 'nope' })).toEqual({});
		expect(fromStored(null)).toEqual({});
		expect(fromStored('night')).toEqual({});
	});
});

describe('url overrides', () => {
	it('?theme= previews a palette, setting family and mode', () => {
		expect(fromSearch('?theme=night')).toEqual({ family: 'nocturne', mode: 'dark' });
		expect(fromSearch('?theme=dawn&pieces=nocturne&font=geometric')).toEqual({
			family: 'nocturne',
			mode: 'light',
			pieceSet: 'nocturne',
			font: 'geometric'
		});
	});

	it('?mode= flips on its own, and picks the other side of a ?theme=', () => {
		expect(fromSearch('?mode=light')).toEqual({ mode: 'light' });
		expect(fromSearch('?theme=night&mode=light')).toEqual({ family: 'nocturne', mode: 'light' });
	});

	it('ignores unknown values', () => {
		expect(fromSearch('?theme=nope&mode=dim&pieces=nope&font=nope')).toEqual({});
		expect(fromSearch('')).toEqual({});
	});
});
