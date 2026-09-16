import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

function sources(dir: string, found: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) sources(path, found);
		else if (/\.(svelte|ts)$/.test(entry) && !entry.endsWith('.test.ts')) found.push(path);
	}
	return found;
}

/**
 * A link off the app takes the reader out of it — the owner clicked "Source code" and lost their game.
 * Anchors to another origin open in a new tab, so the app is still there when they come back.
 */
it('opens every link to another site in a new tab', () => {
	const offenders: string[] = [];
	for (const path of sources('src')) {
		for (const [anchor] of readFileSync(path, 'utf8').matchAll(/<a\b[^>]*href="https?:\/\/[^>]*>/g)) {
			if (!anchor.includes('target="_blank"')) offenders.push(`${path}: ${anchor.slice(0, 80)}`);
		}
	}
	expect(offenders).toEqual([]);
});

/** `target="_blank"` without it hands the new tab a handle on this one. */
it('never opens a new tab without noopener', () => {
	const offenders: string[] = [];
	for (const path of sources('src')) {
		for (const [anchor] of readFileSync(path, 'utf8').matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
			if (!anchor.includes('rel="noopener"')) offenders.push(`${path}: ${anchor.slice(0, 80)}`);
		}
	}
	expect(offenders).toEqual([]);
});
