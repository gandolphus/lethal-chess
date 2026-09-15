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

	let { data } = $props();
	const user = $derived((data as { user?: { id: string; email: string } | null }).user ?? null);

	let deleting = $state(false);
	let deleteError = $state<string | null>(null);

	async function deleteAccount() {
		if (!user) return;
		const phrase = 'delete my account';
		const typed = window.prompt(
			`This permanently deletes your account and all your progress. It cannot be undone.\n\nType "${phrase}" to confirm.`
		);
		if (typed?.trim().toLowerCase() !== phrase) return;

		deleting = true;
		deleteError = null;
		try {
			const response = await fetch('/api/account/delete', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ confirm: phrase })
			});
			if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? response.statusText);
			// The account's local copy and unsent outbox go too, so nothing re-uploads it.
			for (const key of Object.keys(localStorage)) {
				if (key.startsWith(`lethal:user:${user.id}:`)) localStorage.removeItem(key);
			}
			window.location.href = '/';
		} catch (error) {
			deleteError = `Could not delete your account: ${(error as Error).message}`;
			deleting = false;
		}
	}
</script>

<svelte:head>
	<title>Settings — Lethal Chess</title>
</svelte:head>

<main>
	<h1>Settings</h1>

	<section class="account">
		<h2>Account & data</h2>
		{#if user}
			<p class="note">Signed in as <strong>{user.email}</strong>. Your progress is saved to your account.</p>
			<div class="account-actions">
				<a class="btn" href="/api/account/export" download>Download my data</a>
				<button type="button" class="btn danger" onclick={deleteAccount} disabled={deleting}>
					{deleting ? 'Deleting…' : 'Delete my account'}
				</button>
			</div>
			{#if deleteError}<p class="note error" role="alert">{deleteError}</p>{/if}
		{:else}
			<p class="note">
				You're not signed in, so your progress lives only in this browser. <a href="/auth/google">Sign in with Google</a> to
				keep it across devices.
			</p>
		{/if}
		<p class="note"><a href="/privacy">What we store and why</a></p>
	</section>

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

	.note strong {
		color: var(--text);
		font-weight: 600;
	}

	.note a {
		color: var(--accent);
	}

	.note.error {
		color: var(--bad);
	}

	.account-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0.6rem 0;
	}

	/* The theme and piece pickers style bare buttons as swatch cards; these are ordinary buttons. */
	.account-actions .btn {
		display: inline-flex;
		flex-direction: row;
		align-items: center;
		padding: 0.45rem 0.9rem;
		border-radius: 8px;
		text-decoration: none;
		color: var(--text);
	}

	.account-actions .btn.danger {
		border-color: color-mix(in srgb, var(--bad) 55%, var(--border));
		color: var(--bad);
	}

	.account-actions .btn.danger:hover:not(:disabled) {
		border-color: var(--bad);
		box-shadow: none;
	}

	code {
		font-family: var(--font-num), ui-monospace, monospace;
		color: var(--text);
	}
</style>
