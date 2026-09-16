import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The fifteen palettes that existed before the scene work are frozen here, token by token. Adding a
 * capability to the contract must not move one of them by a pixel, so a change to any token they set —
 * or a token they lose — fails this test. The default block may gain tokens (that is how the contract
 * grows) but may not change the ones it had. To change a palette on purpose, regenerate the fixture:
 * `PALETTES_WRITE=1 pnpm vitest run src/lib/theme/palettes.test.ts`.
 */
const css = readFileSync(new URL('../../app.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Every `[data-theme…] { … }` block's declarations, keyed by its selector list. The default block and
 * the alias block share `:root, [data-theme]`, so a repeated selector merges into one record.
 */
export function paletteTokens(source: string): Record<string, Record<string, string>> {
	const palettes: Record<string, Record<string, string>> = {};
	for (const [, prelude, body] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		// The prelude is everything since the previous `}`; a theme block's is its selector list alone.
		const selector = prelude.replace(/\s+/g, ' ').trim();
		if (!/\[data-theme/.test(selector)) continue;
		const tokens = (palettes[selector] ??= {});
		for (const [, name, value] of body.matchAll(/(--[\w-]+|color-scheme)\s*:\s*([^;]+);/g)) {
			tokens[name] = value.replace(/\s+/g, ' ').trim();
		}
	}
	return palettes;
}

const FIXTURE = new URL('./palettes.frozen.json', import.meta.url);

describe('the palettes that predate the scene contract', () => {
	const current = paletteTokens(css);

	if (process.env.PALETTES_WRITE || !existsSync(FIXTURE)) {
		it('are written to the fixture', () => {
			writeFileSync(FIXTURE, JSON.stringify(current, null, '\t') + '\n');
		});
		return;
	}

	const frozen: Record<string, Record<string, string>> = JSON.parse(readFileSync(FIXTURE, 'utf8'));
	for (const [selector, tokens] of Object.entries(frozen)) {
		it(`${selector} sets exactly what it did`, () => {
			expect(current[selector]).toBeDefined();
			// The default block is the contract: it may grow, never move. A palette block is one look: it
			// may do neither.
			const isDefault = selector.startsWith(':root');
			const compared = isDefault
				? Object.fromEntries(Object.entries(current[selector]).filter(([name]) => name in tokens))
				: current[selector];
			expect(compared).toEqual(tokens);
		});
	}
});
