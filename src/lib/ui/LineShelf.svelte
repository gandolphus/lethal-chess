<script lang="ts">
	import type { VariationSummary } from '$lib/explore/book';

	let {
		variations,
		here = null,
		count = $bindable<HTMLElement | null>(null),
		onopen
	}: {
		variations: VariationSummary[];
		/** The variation the game is in, ringed on the shelf. */
		here?: string | null;
		/** The counter element, for anything that wants to fly into it. */
		count?: HTMLElement | null;
		/** A click on a segment opens the map at that band ("Sidelines" for the folded one). */
		onopen?: (band: string) => void;
	} = $props();

	/**
	 * The opening at a glance: one segment per variation, as wide as its number of lines — lit for lines
	 * discovered, warm for lines entered, fog for the rest. Single-line variations share one "Sidelines" segment.
	 */
	const segments = $derived.by(() => {
		const big = variations.filter((v) => v.total > 1);
		const small = variations.filter((v) => v.total === 1);
		const sidelines = small.length
			? [{ name: 'Sidelines', total: small.length, discovered: small.reduce((n, v) => n + v.discovered, 0), entered: small.reduce((n, v) => n + v.entered, 0), names: small.map((v) => v.name) }]
			: [];
		return [...big.map((v) => ({ ...v, names: [v.name] })), ...sidelines];
	});

	const totals = $derived(
		variations.reduce((t, v) => ({ total: t.total + v.total, discovered: t.discovered + v.discovered }), { total: 0, discovered: 0 })
	);

	const short = (name: string) => name.replace(/^[^:]+:\s*/, '') || name;

	// The counter bumps when it changes.
	let bump = $state(0);
	let previous = -1;
	$effect(() => {
		if (previous >= 0 && totals.discovered > previous) bump++;
		previous = totals.discovered;
	});
</script>

<div class="shelf">
	<div class="segments" role="img" aria-label="{totals.discovered} of {totals.total} lines discovered">
		{#each segments as segment (segment.name)}
			<button
				type="button"
				class="segment"
				class:here={here !== null && segment.names.includes(here)}
				style="flex-grow: {segment.total}"
				title="{short(segment.name)} — {segment.discovered} of {segment.total} discovered{segment.entered ? `, ${segment.entered} entered` : ''}"
				aria-label="{short(segment.name)}: {segment.discovered} of {segment.total} discovered. Open the map."
				disabled={!onopen}
				onclick={() => onopen?.(segment.name)}
			>
				<span class="lit" style="width: {(segment.discovered / segment.total) * 100}%"></span>
				<span class="warm" style="width: {(segment.entered / segment.total) * 100}%"></span>
			</button>
		{/each}
	</div>
	{#key bump}
		<p class="count num" class:bump={bump > 0} bind:this={count}>
			<strong>{totals.discovered}</strong><span>/{totals.total}</span>
		</p>
	{/key}
</div>

<style>
	.shelf {
		display: flex;
		align-items: center;
		gap: 0.8rem;
		margin-top: 0.7rem;
	}

	.segments {
		display: flex;
		flex: 1;
		gap: 2px;
		height: 10px;
		min-width: 0;
	}

	.segment {
		position: relative;
		display: flex;
		flex-basis: 0;
		min-width: 3px;
		padding: 0;
		border: 0;
		border-radius: 2px;
		overflow: hidden;
		cursor: pointer;
		transition: transform 160ms var(--ease);
		background: repeating-linear-gradient(
			-45deg,
			color-mix(in srgb, var(--text-3) 26%, transparent) 0 2px,
			color-mix(in srgb, var(--text-3) 10%, transparent) 2px 5px
		);
	}

	.segment.here {
		box-shadow: 0 0 0 1.5px var(--accent);
	}

	.segment:disabled {
		cursor: default;
	}

	.segment:hover:not(:disabled),
	.segment:focus-visible {
		transform: scaleY(1.35);
	}

	@media (prefers-reduced-motion: reduce) {
		.segment {
			transition: none;
		}
	}

	.lit {
		background: var(--ok);
	}

	.warm {
		background: color-mix(in srgb, var(--accent) 55%, transparent);
	}

	.count {
		margin: 0;
		white-space: nowrap;
		font-size: 0.85rem;
		color: var(--text-2);
	}

	.count strong {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 400;
		color: var(--text);
	}

	.count.bump {
		animation: bump 520ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	@keyframes bump {
		30% {
			transform: scale(1.12);
			color: var(--ok);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.count.bump {
			animation: none;
		}
	}
</style>
