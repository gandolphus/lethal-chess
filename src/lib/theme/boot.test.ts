import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { FAMILIES, FONTS } from './settings.svelte';

/**
 * `static/theme.js` runs before hydration and so cannot import anything. It carries its own copy of the
 * families and the typeface ids; if the app grows one and the boot script does not, the first paint is a
 * different theme from the second.
 */
const boot = readFileSync('static/theme.js', 'utf8');

it('knows every theme family the app does', () => {
	for (const family of FAMILIES) {
		expect(boot).toContain(`${family.id}: ['${family.dark}', '${family.light}']`);
	}
	// And no more: a family removed from the app must go from the boot script too.
	const listed = [...boot.matchAll(/^\t\t(\w+): \['/gm)].map((m) => m[1]);
	expect(listed.sort()).toEqual(FAMILIES.map((f) => f.id).sort());
});

it('knows every typeface the app does', () => {
	const listed = boot.match(/var FONTS = \[(.*?)\];/)?.[1].split(',').map((s) => s.trim().replace(/'/g, ''));
	expect(listed).toEqual(FONTS.map((f) => f.id));
});
