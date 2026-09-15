import type { Square } from 'chess.js';
import { DIFFICULTIES, Engine, type Difficulty } from '$lib/chess/engine';
import { Game, parseUci } from '$lib/chess/game.svelte';

/** The slice of Engine the controller needs — lets tests drive it with a fake. */
export type EngineLike = Pick<Engine, 'ready' | 'configure' | 'newGame' | 'bestMove' | 'destroy'>;

/**
 * Play-vs-engine policy: whose turn it is, when the engine is asked to move,
 * and how a superseded search is discarded. The drill controller is a sibling
 * of this, reusing Game and Engine rather than this class.
 */
export class PlayController {
	readonly game = new Game();

	engineReady = $state(false);
	engineError = $state<string | null>(null);
	thinking = $state(false);
	resetting = $state(false);
	playerColor = $state<'w' | 'b'>('w');
	difficulty = $state<Difficulty>(DIFFICULTIES[1]);

	#engine: EngineLike | null = null;
	// Bumped whenever the game is replaced, so a search started for an older
	// game can tell it has been superseded and must not touch the board.
	#generation = 0;

	readonly myTurn = $derived(
		!this.game.isOver && this.game.turn === this.playerColor && !this.thinking && !this.resetting
	);

	readonly status = $derived.by(() => {
		const { game } = this;
		if (this.engineError) return this.engineError;
		if (game.status === 'checkmate')
			return game.turn === this.playerColor ? 'Checkmate — you lost' : 'Checkmate — you won';
		if (game.status === 'stalemate') return 'Stalemate';
		if (game.status === 'draw') return 'Draw';
		if (!this.engineReady) return 'Loading engine…';
		if (this.thinking) return 'Engine thinking…';
		return game.turn === this.playerColor ? 'Your move' : 'Engine to move';
	});

	/** Boots the engine. Returns the teardown, for onMount. */
	attach(engine: EngineLike = new Engine()): () => void {
		this.#engine = engine;
		engine.ready
			.then(async () => {
				await engine.configure(this.difficulty);
				this.engineReady = true;
				await this.#engineMove();
			})
			.catch((error: Error) => {
				this.engineError = error.message;
			});
		return () => engine.destroy();
	}

	/** Resolves once the engine has replied (or had nothing to do). */
	async #engineMove() {
		const { game } = this;
		const engine = this.#engine;
		if (!engine || !this.engineReady || this.thinking || game.isOver || game.turn === this.playerColor) return;
		const mine = this.#generation;
		this.thinking = true;
		try {
			const { fen, move } = await engine.bestMove(game.fen, this.difficulty.moveTimeMs);
			if (mine !== this.#generation || fen !== game.fen || !move) return;
			game.move(parseUci(move));
		} catch {
			return; // engine destroyed mid-search
		} finally {
			if (mine === this.#generation) this.thinking = false;
		}
	}

	play(from: Square, to: Square, promotion?: string): Promise<void> {
		if (!this.myTurn || !this.game.move({ from, to, promotion })) return Promise.resolve();
		return this.#engineMove();
	}

	async newGame(color: 'w' | 'b') {
		this.#generation++;
		this.thinking = false;
		this.resetting = true;
		this.playerColor = color;
		this.game.reset();
		try {
			await this.#engine?.newGame();
		} finally {
			this.resetting = false;
		}
		await this.#engineMove();
	}

	async changeDifficulty(next: Difficulty) {
		this.difficulty = next;
		await this.#engine?.configure(next);
	}

	undo(): Promise<void> {
		if (this.thinking) return Promise.resolve();
		this.game.undo();
		// Step back past the engine's reply too, so it lands on the player again.
		if (this.game.turn !== this.playerColor) this.game.undo();
		// As Black at move 1 there is nothing further to undo, so it is the
		// engine's turn again and it has to be asked to move.
		return this.#engineMove();
	}
}
