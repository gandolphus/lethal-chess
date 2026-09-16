import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

/**
 * The template's placeholders are substituted once each, on first occurrence. Naming one inside a comment
 * — as a comment about `theme.js` once did — puts the whole head inside that comment and leaves the real
 * placeholder on the page as text.
 */
it('names each template placeholder exactly once', () => {
	const html = readFileSync('src/app.html', 'utf8');
	for (const placeholder of ['%sveltekit.head%', '%sveltekit.body%']) {
		expect(html.split(placeholder)).toHaveLength(2);
	}
});

it('puts the theme script before the head is injected', () => {
	const html = readFileSync('src/app.html', 'utf8');
	expect(html.indexOf('/theme.js')).toBeGreaterThan(0);
	expect(html.indexOf('/theme.js')).toBeLessThan(html.indexOf('%sveltekit.head%'));
});
