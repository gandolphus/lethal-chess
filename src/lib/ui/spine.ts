/**
 * The spine on an opening card: one segment per variation, as wide as that variation's lines, lit for
 * what has been found and warm for what has been entered.
 */
export type Segment = { n: number; lit: number; warm: number };

/**
 * A segment is 3px wide with a 2px gap, so past about forty of them the row is wider than a phone — and
 * a row wider than the window makes the browser zoom the whole page out, shrinking every other thing on
 * it. The Queen's Gambit has 94 variations; past the cap the tail becomes one segment, which is all a
 * 3px sliver could have said anyway.
 */
export const MAX_SEGMENTS = 40;

export const capped = (sizes: number[]): number[] =>
	sizes.length <= MAX_SEGMENTS
		? sizes
		: [...sizes.slice(0, MAX_SEGMENTS - 1), sizes.slice(MAX_SEGMENTS - 1).reduce((a, b) => a + b, 0)];

/**
 * The found and entered counts are laid in from the first variation, since the picker doesn't know which
 * variation each discovered line belongs to.
 */
export function spine(sizes: number[], { discovered, entered }: { discovered: number; entered: number }): Segment[] {
	let d = discovered;
	let e = entered;
	return capped(sizes).map((n) => {
		const lit = Math.min(n, d);
		d -= lit;
		const warm = Math.min(n - lit, e);
		e -= warm;
		return { n, lit: lit / n, warm: warm / n };
	});
}
