<script lang="ts">
	import Piece from '$lib/components/Piece.svelte';

	// A diagram, not a board: squares and pieces in the active theme, nothing interactive.
	let { fen, orientation = 'w' }: { fen: string; orientation?: 'w' | 'b' } = $props();

	const FILES = 'abcdefgh';

	const squares = $derived.by(() => {
		const rows = fen.split(' ')[0].split('/');
		const cells: { light: boolean; piece: { type: string; color: 'w' | 'b' } | null }[] = [];
		rows.forEach((row, r) => {
			let f = 0;
			for (const char of row) {
				if (/\d/.test(char)) {
					for (let i = 0; i < Number(char); i++) cells.push({ light: (f++ + r) % 2 === 0, piece: null });
					continue;
				}
				cells.push({
					light: (f + r) % 2 === 0,
					piece: { type: char.toLowerCase(), color: char === char.toUpperCase() ? 'w' : 'b' }
				});
				f++;
			}
		});
		return orientation === 'w' ? cells : cells.reverse();
	});
</script>

<span class="mini" aria-hidden="true">
	{#each squares as cell, i (i)}
		<span class="sq" class:light={cell.light}>
			{#if cell.piece}<Piece type={cell.piece.type} color={cell.piece.color} lit={false} />{/if}
		</span>
	{/each}
</span>

<style>
	.mini {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		width: 100%;
		aspect-ratio: 1;
		border-radius: 4px;
		overflow: hidden;
		box-shadow: 0 0 0 1px var(--frame-edge);
		container-type: inline-size;
		--piece-shadow: none;
		--piece-size: 9cqi;
	}

	.sq {
		position: relative;
		display: grid;
		place-items: center;
		background: var(--sq-dark);
	}

	.sq.light {
		background: var(--sq-light);
	}
</style>
