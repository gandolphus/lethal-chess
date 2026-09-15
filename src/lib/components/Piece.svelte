<script lang="ts">
	import { GLYPHS } from '$lib/chess/pieces';
	import { appearance } from '$lib/theme/settings.svelte';
	import { ensurePieceSprite, isSvgSet, symbolId } from '$lib/theme/pieces';

	let {
		type,
		color,
		set,
		lit = true
	}: {
		type: string;
		color: 'w' | 'b';
		set?: string;
		/** Off for pieces that move every frame (drag ghost): skips per-piece lighting filters. */
		lit?: boolean;
	} = $props();

	const activeSet = $derived(set ?? appearance.pieceSet);
	const svg = $derived(isSvgSet(activeSet));

	$effect(() => {
		if (svg) ensurePieceSprite(activeSet);
	});
</script>

<!-- Every piece set renders through here, so the board never knows which set is active. -->
{#if svg}
	<svg class="piece svg {color}" data-set={activeSet} viewBox="0 0 100 100" aria-hidden="true">
		<use href="#{symbolId(activeSet, color, type, lit)}" width="100" height="100" />
	</svg>
{:else}
	<span class="piece glyph {color}" data-set={activeSet} aria-hidden="true">{GLYPHS[type]}</span>
{/if}

<style>
	.piece {
		position: relative;
		z-index: 2;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.piece.svg {
		display: block;
		overflow: visible;
		filter: var(--piece-shadow, none);
	}

	.piece.glyph {
		display: grid;
		place-items: center;
		font-size: var(--piece-size, 4rem);
		line-height: 1;
	}

	.piece.glyph.w {
		color: var(--pw1, #f4f4fa);
		text-shadow:
			0 0 2px rgb(0 0 0 / 0.95),
			0 2px 3px rgb(0 0 0 / 0.55);
	}

	.piece.glyph.b {
		color: var(--pb2, #12121c);
		text-shadow:
			0 0 2px rgb(255 255 255 / 0.4),
			0 2px 3px rgb(0 0 0 / 0.5);
	}
</style>
