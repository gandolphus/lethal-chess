/**
 * On a phone the site bar is one row of glyphs, so the words that name each destination are hidden with
 * `clip-path` rather than `display: none` — the difference between a link a screen reader can announce
 * and one it reads as "link". The gear is a glyph at every width, so its word is hidden the same way at
 * every width. These read the source because the rule is in the markup and the stylesheet, not in
 * anything that can be called.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const LAYOUT = readFileSync(new URL('./+layout.svelte', import.meta.url), 'utf8');
const LAYER = readFileSync(new URL('../lib/ui/Layer.svelte', import.meta.url), 'utf8');

/** The declarations of one rule, or '' if it is not there. */
const rule = (css: string, selector: string) => css.match(new RegExp(`${selector.replace(/[.[\]]/g, '\\$&')} \\{([^}]*)\\}`, 's'))?.[1] ?? '';

/** What hides text from the eye and not from a screen reader. */
const expectHiddenWord = (declarations: string) => {
	expect(declarations).toContain('clip-path');
	expect(declarations).not.toContain('display: none');
	expect(declarations).not.toContain('visibility: hidden');
};

describe('the site bar', () => {
	it('gives every destination and every tool both a glyph and a word', () => {
		// The loop covers Openings, Today and Play; then Admin, for the one account that sees it; then
		// the gear. Every glyph is followed by the word it stands in for.
		const rendered = [...LAYOUT.matchAll(/\{@render glyph\(([^)]+)\)\}(<span class="word">[^<]+<\/span>)?/g)];
		expect(rendered.length).toBe(3);
		for (const [, arg, word] of rendered) expect([arg, word]).toEqual([arg, expect.stringContaining('class="word"')]);
		for (const icon of ['board', 'calendar', 'play', 'gear', 'shield']) {
			expect(LAYOUT).toContain(`name === '${icon}'`);
		}
	});

	it('keeps the destinations to places you go, and the gear apart from them', () => {
		expect([...LAYOUT.matchAll(/icon: '([a-z]+)'/g)].map((m) => m[1])).toEqual(['board', 'calendar', 'play']);
		expect(LAYOUT).toContain('<div class="tools">');
		expect(LAYOUT).toMatch(/class="tool"\s+href="\/settings"/);
	});

	it('hides the destinations\' words on a phone without hiding them from a screen reader', () => {
		const phone = LAYOUT.slice(LAYOUT.indexOf('@media (max-width: 560px)'));
		expectHiddenWord(rule(phone, '.word'));
	});

	it('hides the gear\'s word at every width the same way', () => {
		const desktop = LAYOUT.slice(0, LAYOUT.indexOf('@media (max-width: 560px)'));
		expectHiddenWord(rule(desktop, '.tool .word'));
		expect(rule(desktop, '.tool .icon')).toContain('display: block');
	});

	it('stays one row on a phone, so the bar costs the same height everywhere', () => {
		const phone = LAYOUT.slice(LAYOUT.indexOf('@media (max-width: 560px)'));
		const site = rule(phone, '.site');
		expect(site).not.toContain('flex-wrap: wrap');
		expect(site).not.toContain('height: auto');
	});

	it('says what the gear opens', () => {
		expect(LAYOUT).toContain('aria-haspopup="dialog"');
		expect(LAYOUT).toContain("aria-expanded={layer === 'settings'}");
	});
});

describe('a layer', () => {
	it('is a native modal dialog, so the page beneath is inert and focus comes back on its own', () => {
		expect(LAYER).toContain('<dialog');
		expect(LAYER).toContain('dialog.showModal()');
		expect(LAYER).toContain('aria-modal="true"');
		expect(LAYER).toContain('aria-labelledby="layer-title"');
	});

	it('closes through the page, never on its own, so the history entry always follows', () => {
		// Escape is the dialog's `cancel`; it is prevented and routed through `close()`, which ends in
		// `onclose`. Nothing here calls `dialog.close()`.
		expect(LAYER).toMatch(/oncancel=\{\(event\) => \{\s*event\.preventDefault\(\);\s*void close\(\);/);
		const code = LAYER.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, '');
		expect(code).not.toContain('dialog.close(');
	});

	it('keeps every key to itself, since the page beneath listens on the window for its shortcuts', () => {
		expect(LAYER).toContain('onkeydown={(event) => event.stopPropagation()}');
	});

	it('contains its own scrolling and locks the page behind it', () => {
		expect(rule(LAYER, '.body')).toContain('overscroll-behavior: contain');
		expect(LAYER).toContain(':global(:root:has(dialog[data-layer][open]))');
	});
});
