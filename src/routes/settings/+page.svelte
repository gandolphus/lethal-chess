<script lang="ts">
	import Piece from '$lib/components/Piece.svelte';
	import ThemeSwatch from '$lib/theme/ThemeSwatch.svelte';
	import { appearance, AVAILABLE_PIECE_SETS, THEMES } from '$lib/theme/settings.svelte';

	const group = <T extends { collection: string }>(items: T[]) =>
		[...new Set(items.map((i) => i.collection))].map((collection) => ({
			collection,
			items: items.filter((i) => i.collection === collection)
		}));

	const PREVIEW = ['k', 'q', 'n', 'b'];
</script>

<svelte:head>
	<title>Settings — Lethal Chess</title>
</svelte:head>

<main>
	<h1>Settings</h1>

	<section>
		<h2>Theme</h2>
		{#each group(THEMES) as { collection, items } (collection)}
			<p class="collection">{collection}</p>
			<div class="options">
				{#each items as theme (theme.id)}
					<button
						type="button"
						class="theme-option"
						class:active={appearance.theme === theme.id}
						aria-pressed={appearance.theme === theme.id}
						onclick={() => appearance.set({ theme: theme.id })}
					>
						<ThemeSwatch {theme} />
						<span class="label"><span>{theme.name}</span><small>{theme.mode}</small></span>
					</button>
				{/each}
			</div>
		{/each}
	</section>

	<section>
		<h2>Pieces</h2>
		{#each group(AVAILABLE_PIECE_SETS) as { collection, items } (collection)}
			<p class="collection">{collection}</p>
			<div class="options">
				{#each items as set (set.id)}
					<button
						type="button"
						class="piece-option"
						class:active={appearance.pieceSet === set.id}
						aria-pressed={appearance.pieceSet === set.id}
						onclick={() => appearance.set({ pieceSet: set.id })}
					>
						<span class="preview">
							{#each ['w', 'b'] as const as color (color)}
								{#each PREVIEW as type, i (type)}
									<span class="cell" class:light={(i + (color === 'w' ? 0 : 1)) % 2 === 0}>
										<span class="preview-piece"><Piece {type} {color} set={set.id} /></span>
									</span>
								{/each}
							{/each}
						</span>
						<span class="label"><span>{set.name}</span>{#if set.credit}<small>{set.credit}</small>{/if}</span>
					</button>
				{/each}
			</div>
		{/each}
	</section>

	<p class="note">Preview any look without saving it: <code>?theme=night&amp;pieces=nocturne</code> on any page.</p>
</main>

<style>
	main {
		max-width: 960px;
		margin: 0 auto;
		padding: 2rem 1.5rem 4rem;
	}

	h1 {
		margin: 0 0 1.5rem;
		font-family: var(--font-display);
		font-weight: 500;
	}

	h2 {
		margin: 0 0 0.3rem;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.5rem;
	}

	section {
		margin-bottom: 2rem;
	}

	.collection {
		margin: 0.8rem 0 0.4rem;
		font-size: 0.85rem;
		color: var(--text-2);
	}

	.options {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 0.6rem;
	}

	button {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.45rem;
		padding: 0.5rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface-1);
		cursor: pointer;
		text-align: left;
	}

	button:hover {
		border-color: var(--text-3);
	}

	button.active {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent);
	}

	.label {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0 0.2rem 0.1rem;
	}

	small {
		color: var(--text-2);
		font-size: 0.72rem;
		text-align: right;
	}

	.preview {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		border-radius: var(--radius);
		overflow: hidden;
		box-shadow: 0 0 0 1px var(--frame-edge);
	}

	.cell {
		display: block;
		aspect-ratio: 1;
		background: var(--sq-dark);
	}

	.cell.light {
		background: var(--sq-light);
	}

	.preview-piece {
		display: block;
		width: 100%;
		height: 100%;
		padding: 4%;
		--piece-size: 1.5rem;
	}

	.note {
		font-size: 0.85rem;
		color: var(--text-2);
	}

	code {
		font-family: var(--font-num), ui-monospace, monospace;
		color: var(--text);
	}
</style>
