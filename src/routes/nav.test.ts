/**
 * On a phone the site bar is one row of glyphs, so the words that name each destination are hidden with
 * `clip-path` rather than `display: none` — the difference between a link a screen reader can announce
 * and one it reads as "link". These read the source because the rule is in the markup and the
 * stylesheet, not in anything that can be called.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const LAYOUT = readFileSync(new URL('./+layout.svelte', import.meta.url), 'utf8');

describe('the site bar', () => {
	it('gives every destination both a glyph and a word', () => {
		// The loop covers Openings, Today, Play and Settings; the second is Admin, for the one account
		// that sees it. Every glyph is followed by the word it stands in for.
		const rendered = [...LAYOUT.matchAll(/\{@render glyph\(([^)]+)\)\}(<span class="word">[^<]+<\/span>)?/g)];
		expect(rendered.length).toBe(2);
		for (const [, arg, word] of rendered) expect([arg, word]).toEqual([arg, expect.stringContaining('class="word"')]);
		for (const icon of ['board', 'calendar', 'play', 'sliders', 'shield']) {
			expect(LAYOUT).toContain(`name === '${icon}'`);
		}
		expect([...LAYOUT.matchAll(/icon: '([a-z]+)'/g)].map((m) => m[1])).toEqual(['board', 'calendar', 'play', 'sliders']);
	});

	it('hides those words from the eye without hiding them from a screen reader', () => {
		const phone = LAYOUT.slice(LAYOUT.indexOf('@media (max-width: 560px)'));
		const word = phone.match(/\.word \{([^}]*)\}/s)?.[1] ?? '';
		expect(word).toContain('clip-path');
		expect(word).not.toContain('display: none');
		expect(word).not.toContain('visibility: hidden');
	});

	it('stays one row on a phone, so the bar costs the same height everywhere', () => {
		const phone = LAYOUT.slice(LAYOUT.indexOf('@media (max-width: 560px)'));
		const site = phone.match(/\.site \{([^}]*)\}/s)?.[1] ?? '';
		expect(site).not.toContain('flex-wrap: wrap');
		expect(site).not.toContain('height: auto');
	});
});
