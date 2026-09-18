<script lang="ts">
	// Design review: one position carrying every mark and arrow kind the board can
	// draw, so a theme can be judged (and screenshotted) without playing through a drill.
	import Board from '$lib/components/Board.svelte';
	import Piece from '$lib/components/Piece.svelte';
	import type { Arrow, SquareMarks } from '$lib/components/board';
	import { Game } from '$lib/chess/game.svelte';
	import { appearance } from '$lib/theme/settings.svelte';

	const game = new Game();
	game.load(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'g8f6']);

	/**
	 * A second position, for the captured rows: the Ruy Lopez Exchange and a pawn after it, so both sides
	 * have taken something and White is a pawn ahead — a row of nothing, and a lead of nothing, tell a
	 * reviewer nothing.
	 */
	const traded = new Game();
	traded.load(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5c6', 'd7c6', 'f3e5']);

	const marks: SquareMarks = {
		b5: ['last-move'],
		f1: ['last-move'],
		f3: ['hint'],
		d2: ['correct'],
		c2: ['soft'],
		b1: ['wrong'],
		e8: ['check']
	};
	const arrows: Arrow[] = [
		{ from: 'f3', to: 'e5', kind: 'hint' },
		{ from: 'b1', to: 'c3', kind: 'engine' },
		{ from: 'b5', to: 'c6', kind: 'refutation' }
	];
</script>

<svelte:head>
	<title>Board preview — Lethal Chess</title>
</svelte:head>

<main>
	<div class="stage">
		<Board
			fen={game.fen}
			legalTargets={game.legalTargets}
			needsPromotion={game.needsPromotion}
			{marks}
			{arrows}
			onMove={() => {}}
		/>
	</div>
	<aside>
		<h1>Board preview</h1>
		<p>{appearance.themeOption.name} · {appearance.pieceSet}</p>
		<ul>
			<li>b5, f1 — last move</li>
			<li>f3 — hint square; arrows: hint, engine, refutation</li>
			<li>d2 correct · c2 soft · b1 wrong · e8 check</li>
			<li>Click Nf3 for dark-square targets and a capture; Bb5 for light ones.</li>
		</ul>

		<!-- The captured rows: what each side has taken, and the lead. -->
		<h2>Captured material</h2>
		<div class="traded">
			<Board fen={traded.fen} legalTargets={() => []} interactive={false} onMove={() => {}} />
		</div>

		<!-- Every piece of the active set on both square colours: the sheet for judging a set. -->
		<div class="sheet">
			{#each ['w', 'b'] as const as color (color)}
				{#each ['light', 'dark'] as shade (shade)}
					{#each ['k', 'q', 'r', 'b', 'n', 'p'] as type (type)}
						<span class="cell" class:light={shade === 'light'}><Piece {type} {color} /></span>
					{/each}
				{/each}
			{/each}
		</div>
	</aside>
</main>

<style>
	h2 {
		margin: 1.5rem 0 0.5rem;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.traded {
		width: 17rem;
	}

	main {
		display: flex;
		gap: 2rem;
		max-width: 1180px;
		margin: 0 auto;
		padding: 1.5rem;
		align-items: flex-start;
	}

	.stage {
		flex: 1 1 520px;
		display: flex;
		justify-content: center;
	}

	aside {
		flex: 1 1 260px;
		color: var(--text-2);
		font-size: 0.9rem;
	}

	h1 {
		margin: 0;
		font-size: 1.2rem;
		color: var(--text);
	}

	ul {
		padding-left: 1.1rem;
	}

	.sheet {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		margin-top: 1rem;
		border-radius: var(--radius);
		overflow: hidden;
	}

	.cell {
		display: block;
		aspect-ratio: 1;
		padding: 4%;
		background: var(--sq-dark);
		--piece-size: 2rem;
	}

	.cell.light {
		background: var(--sq-light);
	}
</style>
