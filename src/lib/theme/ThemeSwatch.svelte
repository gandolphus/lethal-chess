<script lang="ts">
	import Piece from '$lib/components/Piece.svelte';
	import type { ThemeOption } from './settings.svelte';

	let { theme }: { theme: ThemeOption } = $props();

	// A 4×4 corner of a position: a last move, a selected knight with two legal
	// squares, an enemy king — enough to show the theme's squares, highlights and pieces.
	const CELLS = Array.from({ length: 16 }, (_, i) => ({
		light: ((i % 4) + Math.floor(i / 4)) % 2 === 0,
		sel: i === 9,
		last: i === 3 || i === 6,
		dot: i === 4 || i === 15,
		piece: i === 9 ? { type: 'n', color: 'w' as const } : i === 2 ? { type: 'k', color: 'b' as const } : null
	}));
</script>

<!-- Theme tokens are keyed by [data-theme], so scoping them to this subtree previews the real palette. -->
<span class="swatch" data-theme={theme.id} data-mode={theme.mode} data-board={theme.board}>
	<span class="mini">
		{#each CELLS as cell, i (i)}
			<span class="sq" class:light={cell.light} class:sel={cell.sel} class:last={cell.last} class:dot={cell.dot}>
				{#if cell.piece}
					<span class="pc"><Piece type={cell.piece.type} color={cell.piece.color} /></span>
				{/if}
			</span>
		{/each}
	</span>
</span>

<style>
	.swatch {
		display: block;
		padding: 10px;
		border-radius: 8px;
		background: var(--bg);
		border: 1px solid var(--border);
		container-type: inline-size;
	}

	.mini {
		display: grid;
		/* The grid gap is a theme's own, but it must not change the swatch's height. */
		box-sizing: border-box;
		grid-template-columns: repeat(4, 1fr);
		grid-template-rows: repeat(4, 1fr);
		aspect-ratio: 1;
		gap: var(--grid-gap);
		padding: var(--grid-gap);
		background: var(--grid-color);
		border-radius: var(--radius);
		overflow: hidden;
		box-shadow: 0 0 0 1px var(--frame-edge);
	}

	.sq {
		position: relative;
		background: var(--sq-dark);
	}

	.sq.light {
		background: var(--sq-light);
	}

	.sq::before {
		content: '';
		position: absolute;
		inset: 0;
		mix-blend-mode: var(--hl-blend);
	}

	.sq.last::before {
		background: var(--last);
	}

	.sq.sel::before {
		background: var(--sel);
		box-shadow: inset 0 0 0 2px var(--ring);
	}

	.sq.dot::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		width: 27%;
		aspect-ratio: 1;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		background: var(--dot-on-dark);
	}

	.sq.light.dot::after {
		background: var(--dot);
	}

	.pc {
		position: absolute;
		inset: 4%;
		z-index: 2;
		--piece-size: 4.5cqi;
	}
</style>
