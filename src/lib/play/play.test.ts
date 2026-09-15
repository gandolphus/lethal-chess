// Regression tests for the play loop (Fable code audit #1 and #2), driven by a
// fake engine whose searches resolve only when the test says so.

import { describe, expect, it } from 'vitest';
import { PlayController, type EngineLike } from './play.svelte';

type PendingSearch = { fen: string; resolve: (move: string) => void };

function fakeEngine() {
	const searches: PendingSearch[] = [];
	const engine: EngineLike = {
		ready: Promise.resolve(),
		configure: async () => {},
		newGame: async () => {},
		destroy: () => {},
		bestMove: (fen: string) =>
			new Promise((resolve) => searches.push({ fen, resolve: (move) => resolve({ fen, move }) }))
	};
	return { engine, searches };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('PlayController', () => {
	it('asks the engine to move again after undo as Black at move 1', async () => {
		const { engine, searches } = fakeEngine();
		const play = new PlayController();
		play.attach(engine);
		await settle();

		const reset = play.newGame('b');
		await settle();
		searches.at(-1)!.resolve('e2e4');
		await reset;
		expect(play.game.history).toEqual(['e4']);

		const undone = play.undo();
		await settle();
		expect(play.game.history).toEqual([]);
		expect(play.thinking).toBe(true); // the audit's bug: this stayed false forever
		searches.at(-1)!.resolve('d2d4');
		await undone;
		expect(play.game.history).toEqual(['d4']);
	});

	it('discards a search that was superseded by a new game', async () => {
		const { engine, searches } = fakeEngine();
		const play = new PlayController();
		play.attach(engine);
		await settle();

		const first = play.newGame('b');
		await settle();
		const stale = searches.at(-1)!;

		const second = play.newGame('b');
		await settle();
		// The old search finishes after the reset with a move that is legal in the new game too.
		stale.resolve('g1f3');
		await first;
		expect(play.game.history).toEqual([]);

		searches.at(-1)!.resolve('c2c4');
		await second;
		expect(play.game.history).toEqual(['c4']);
	});

	it('ignores player moves when it is not their turn', async () => {
		const { engine } = fakeEngine();
		const play = new PlayController();
		play.attach(engine);
		await settle();
		void play.newGame('b');
		await settle();
		await play.play('e7', 'e5');
		expect(play.game.history).toEqual([]);
	});

	it('surfaces an engine load failure as the status', async () => {
		const play = new PlayController();
		play.attach({ ...fakeEngine().engine, ready: Promise.reject(new Error('Engine failed to load: 404')) });
		await settle();
		expect(play.status).toBe('Engine failed to load: 404');
	});
});
