<script lang="ts">
	import { onMount } from 'svelte';
	import Board from '$lib/components/Board.svelte';
	import { markMove, mergeMarks } from '$lib/components/board';
	import { DIFFICULTIES } from '$lib/chess/engine';
	import { PlayController } from '$lib/play/play.svelte';
	import { movePairs } from '$lib/ui/position';

	const play = new PlayController();
	const { game } = play;

	onMount(() => play.attach());

	const marks = $derived(
		mergeMarks(
			markMove(game.lastMove, 'last-move'),
			game.checkSquare ? { [game.checkSquare]: ['check'] } : {}
		)
	);

	const pairs = $derived(movePairs(game.history));
	const tone = $derived(
		game.status === 'checkmate' ? (game.turn === play.playerColor ? 'fail' : 'pass') : play.thinking ? 'wait' : undefined
	);
</script>

<svelte:head>
	<title>Play — Lethal Chess</title>
</svelte:head>

<main>
	<div class="layout">
		<div class="board-column">
			<Board
				fen={game.fen}
				orientation={play.playerColor}
				interactive={play.myTurn}
				legalTargets={game.legalTargets}
				needsPromotion={game.needsPromotion}
				{marks}
				onMove={(from, to, promotion) => play.play(from, to, promotion)}
			/>
		</div>

		<aside class="panel">
			<header>
				<h1>Play the computer</h1>
				<p class="dim">A plain game against Stockfish, at the strength you pick. No coaching here — that lives in the drills.</p>
			</header>

			<div class="notice" data-tone={tone} aria-live="polite">
				<p class="title">
					<i class="turn" class:black={game.turn === 'b'} aria-hidden="true"></i>
					{play.status}
				</p>
			</div>

			<div class="group">
				<p class="label">Strength</p>
				<div class="levels" role="group" aria-label="Strength">
					{#each DIFFICULTIES as level (level.id)}
						<button
							type="button"
							class="btn level"
							aria-pressed={play.difficulty.id === level.id}
							onclick={() => play.changeDifficulty(level)}
						>
							{level.label}
							<small class="num">{level.elo ? `~${level.elo}` : 'full'}</small>
						</button>
					{/each}
				</div>
			</div>

			<div class="group actions">
				<button type="button" class="btn primary" onclick={() => play.newGame('w')}>New game as White</button>
				<button type="button" class="btn" onclick={() => play.newGame('b')}>New game as Black</button>
				<button type="button" class="btn" onclick={() => play.undo()} disabled={play.thinking || !game.history.length}>Undo</button>
			</div>

			<ol class="moves num" aria-label="Moves">
				{#each pairs as pair, i (pair.number)}
					<li>
						<span class="n">{pair.number}.</span>
						<span class="m" class:cur={i === pairs.length - 1 && !pair.black}>{pair.white}</span>
						<span class="m" class:cur={i === pairs.length - 1 && pair.black}>{pair.black}</span>
					</li>
				{/each}
				{#if !pairs.length}
					<li class="empty">No moves yet — you have White. Start with any move.</li>
				{/if}
			</ol>
		</aside>
	</div>
</main>

<style>
	main {
		max-width: var(--page-max);
		margin: 0 auto;
		padding: 1.25rem 1.25rem 3rem;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(var(--panel-min), var(--panel-max));
		gap: 2rem;
		align-items: start;
	}

	.board-column {
		display: flex;
		justify-content: center;
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.9rem;
		line-height: 1.1;
	}

	header p {
		margin: 0.3rem 0 0;
		font-size: 0.9rem;
	}

	.notice .title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		font-size: 1.05rem;
		font-weight: 600;
	}

	.turn {
		flex: none;
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 50%;
		background: var(--pw1);
		box-shadow: 0 0 0 1.5px var(--pws) inset;
	}

	.turn.black {
		background: var(--pb2);
		box-shadow: 0 0 0 1.5px var(--pbh) inset;
	}

	.label {
		margin: 0 0 0.45rem;
		font-size: 0.8rem;
		color: var(--text-2);
	}

	.levels {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
		gap: 0.35rem;
	}

	.level {
		flex-direction: column;
		align-items: flex-start;
		gap: 0.1rem;
		padding: 0.45rem 0.6rem;
		font-size: 0.85rem;
	}

	.level small {
		font-size: 0.7rem;
		color: var(--text-2);
	}

	.level[aria-pressed='true'] {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.moves {
		display: grid;
		grid-template-columns: 2.4em 1fr 1fr;
		row-gap: 2px;
		margin: 0;
		padding: 0.6rem 0 0;
		list-style: none;
		border-top: 1px solid var(--border);
		font-size: 0.95rem;
		max-height: 16rem;
		overflow-y: auto;
	}

	.moves li {
		display: contents;
	}

	.moves .n {
		color: var(--text-3);
		padding: 2px 0;
	}

	.moves .m {
		padding: 2px 8px;
		border-radius: 4px;
	}

	.moves .m.cur {
		background: var(--surface-2);
		font-weight: 600;
	}

	.moves .empty {
		display: block;
		grid-column: 1 / -1;
		color: var(--text-2);
		font-family: var(--font-ui);
	}

	@media (max-width: 860px) {
		main {
			padding: 0.75rem 0.75rem 2.5rem;
		}

		.layout {
			grid-template-columns: 1fr;
			gap: 0.9rem;
		}

		.panel {
			display: grid;
		}

		.notice {
			order: -1;
		}
	}
</style>
