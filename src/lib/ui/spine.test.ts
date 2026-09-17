import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MAX_SEGMENTS, capped, spine } from './spine';

/** What the stylesheet draws each segment with; the test reads them so the two cannot drift apart. */
const HOME = readFileSync(new URL('../../routes/+page.svelte', import.meta.url), 'utf8');
const px = (rule: RegExp) => Number(HOME.match(rule)?.[1]);

describe('the spine never makes the page wider than a phone', () => {
	it('is drawn with the widths this cap was chosen for', () => {
		// `.spine { gap: 2px }` and `.spine i { min-width: 3px }`.
		expect(px(/\.spine \{[^}]*gap: (\d+)px/s)).toBe(2);
		expect(px(/\.spine i \{[^}]*min-width: (\d+)px/s)).toBe(3);
	});

	it('fits inside a 390px phone at its widest', () => {
		const width = MAX_SEGMENTS * 3 + (MAX_SEGMENTS - 1) * 2;
		// The card's content box on the narrowest phone the app targets, less its padding.
		expect(width).toBeLessThan(390 - 2 * 24);
	});

	it('leaves a short opening exactly as it is', () => {
		const sizes = [8, 5, 3, 1];
		expect(capped(sizes)).toEqual(sizes);
	});

	it("folds a long opening's tail into one segment, keeping every line counted", () => {
		// The Queen's Gambit: 94 variations, which at 5px apiece is 468px — wider than the window.
		const sizes = Array.from({ length: 94 }, (_, i) => 94 - i);
		const out = capped(sizes);
		expect(out.length).toBe(MAX_SEGMENTS);
		expect(out.slice(0, MAX_SEGMENTS - 1)).toEqual(sizes.slice(0, MAX_SEGMENTS - 1));
		expect(out.reduce((a, b) => a + b, 0)).toBe(sizes.reduce((a, b) => a + b, 0));
	});

	it('still fills from the front, and a fully found opening is fully lit', () => {
		const sizes = Array.from({ length: 94 }, () => 4);
		const total = sizes.reduce((a, b) => a + b, 0);
		const all = spine(sizes, { discovered: total, entered: 0 });
		expect(all.every((s) => s.lit === 1)).toBe(true);

		const some = spine([8, 5, 3], { discovered: 9, entered: 2 });
		expect(some[0]).toEqual({ n: 8, lit: 1, warm: 0 });
		expect(some[1]).toEqual({ n: 5, lit: 1 / 5, warm: 2 / 5 });
		expect(some[2]).toEqual({ n: 3, lit: 0, warm: 0 });
	});
});
