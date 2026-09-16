import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { TRACE_STEP_MS } from './session.svelte';

/**
 * Resuming a line waits for the board to finish drawing the route before it plays the move that was
 * clicked. The wait is computed from `TRACE_STEP_MS`; the drawing is a CSS animation. If the stagger in
 * `Board.svelte` changes and this does not, the move lands early or the board sits still after the route.
 */
it('waits exactly as long as the board takes to draw a route', () => {
	const board = readFileSync('src/lib/components/Board.svelte', 'utf8');
	expect(board).toContain(`calc(var(--i) * ${TRACE_STEP_MS}ms)`);
});
