<script lang="ts">
	// Five ticks, as in the design prototypes: a value the eye reads without a number.
	let { level, label }: { level: number; label: string } = $props();
</script>

<span class="meter" role="img" aria-label="{label}: {level} of 5" data-level={level}>
	{#each [1, 2, 3, 4, 5] as tick (tick)}
		<i class:on={tick <= level}></i>
	{/each}
</span>

<style>
	.meter {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 3px;
		height: 6px;
	}

	.meter i {
		border-radius: 2px;
		background: var(--surface-2);
		box-shadow: 0 0 0 1px var(--border) inset;
	}

	.meter i.on {
		background: var(--accent);
		box-shadow: none;
	}

	.meter[data-level='4'] i.on,
	.meter[data-level='5'] i.on {
		background: var(--bad);
	}
</style>
