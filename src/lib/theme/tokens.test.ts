import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The token contract lives in app.css, not in a module, so the test reads the stylesheet itself.
// Comments go first: the header comment names `[data-theme]` in prose, which is not a selector.
const css = readFileSync(new URL('../../app.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

type BlackPiece = { pb1: string; pbs: string; pbh: string };

/** Every `[data-theme…] { … }` block that sets the black-piece tokens, keyed by its selector. */
function blackPieceTokens(): Map<string, BlackPiece> {
	const themes = new Map<string, BlackPiece>();
	for (const [, selector, body] of css.matchAll(/((?:^|\n)[^{}\n]*\[data-theme[^{]*)\{([^}]*)\}/g)) {
		const token = (name: string) => body.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1].toLowerCase();
		const pb1 = token('pb1');
		const pbs = token('pbs');
		const pbh = token('pbh');
		if (pb1 && pbs && pbh) themes.set(selector.trim(), { pb1, pbs, pbh });
	}
	return themes;
}

const luminance = (hex: string) => {
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe('black piece tokens', () => {
	const themes = blackPieceTokens();

	it('are set by every theme, including the default', () => {
		expect(themes.size).toBeGreaterThanOrEqual(16);
		expect(themes.has('[data-theme]')).toBe(true);
	});

	it('draw one light line only: a theme with a light edge uses it for the detail too', () => {
		// Where --pbs is lighter than the body, the outline is the light line of the piece; the detail
		// highlight must then be the same colour, or each piece with interior detail carries a second
		// outline colour (the owner's "some black pieces get different coloured outlines").
		const lightEdge = [...themes].filter(([, t]) => luminance(t.pbs) > luminance(t.pb1));
		expect(lightEdge.map(([selector]) => selector)).toEqual(
			expect.arrayContaining(["[data-theme='graphite']", "[data-theme='night']"])
		);
		for (const [selector, t] of lightEdge) expect({ selector, pbh: t.pbh }).toEqual({ selector, pbh: t.pbs });
	});
});
