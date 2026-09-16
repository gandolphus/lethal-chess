<script lang="ts">
	import Piece from '$lib/components/Piece.svelte';
	import ThemeSwatch from '$lib/theme/ThemeSwatch.svelte';
	import { appearance, AVAILABLE_PIECE_SETS, FAMILIES, FONTS, MOTIONS, themeFor, type Mode } from '$lib/theme/settings.svelte';

	const MODES: { id: Mode; name: string }[] = [
		{ id: 'dark', name: 'Dark' },
		{ id: 'light', name: 'Light' }
	];

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

	<!-- Appearance is what people come here for; the account is the rare visit, so it sits last. -->
	<section>
		<h2>Theme</h2>
		<!-- Every theme has a dark and a light side; this picks the side, the list below picks the theme. -->
		<div class="mode" role="group" aria-label="Dark or light">
			{#each MODES as mode (mode.id)}
				<button
					type="button"
					class="mode-option"
					class:active={appearance.mode === mode.id}
					aria-pressed={appearance.mode === mode.id}
					onclick={() => appearance.set({ mode: mode.id })}
				>
					{mode.name}
				</button>
			{/each}
		</div>
		<div class="options">
			{#each FAMILIES as family (family.id)}
				{@const theme = themeFor(family.id, appearance.mode)}
				<button
					type="button"
					class="theme-option"
					class:active={appearance.family === family.id}
					aria-pressed={appearance.family === family.id}
					onclick={() => appearance.set({ family: family.id })}
				>
					<ThemeSwatch {theme} />
					<span class="label"><span>{family.name}</span><small>{theme.name}</small></span>
				</button>
			{/each}
		</div>
	</section>

	<section>
		<h2>Pieces</h2>
		<div class="options">
			{#each AVAILABLE_PIECE_SETS as set (set.id)}
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
	</section>

	<section>
		<h2>Movement</h2>
		<p class="collection">How a piece travels to its square</p>
		<div class="segmented" role="group" aria-label="Movement">
			{#each MOTIONS as motion (motion.id)}
				<button
					type="button"
					aria-pressed={appearance.motion === motion.id}
					title={motion.note}
					onclick={() => appearance.set({ motion: motion.id })}>{motion.name}</button
				>
			{/each}
		</div>
		<p class="note">
			{MOTIONS.find((m) => m.id === appearance.motion)?.note}. A device set to reduce motion is never
			animated, whatever is chosen here.
		</p>
	</section>

	<section>
		<h2>Typeface</h2>
		<p class="collection">Chosen apart from the theme</p>
		<div class="options">
			{#each FONTS as font (font.id)}
				<button
					type="button"
					class="font-option"
					class:active={appearance.font === font.id}
					aria-pressed={appearance.font === font.id}
					onclick={() => appearance.set({ font: font.id })}
				>
					<span
						class="type-sample"
						data-font={font.id === 'theme' ? undefined : font.id}
						data-theme={font.id === 'theme' ? appearance.theme : undefined}
					>
						<b>Ruy Lopez</b>
						<i>Closed, Breyer Defense · 1.e4 e5 2.Nf3</i>
					</span>
					<span class="label"><span>{font.name}</span><small>{font.note}</small></span>
				</button>
			{/each}
		</div>
	</section>

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

	<p class="note about">
		<a href="https://github.com/gandolphus/lethal-chess" target="_blank" rel="noopener">Source code</a> · AGPL-3.0 ·
		<a href="/privacy">Privacy</a> · <a href="/credits">Credits &amp; licences</a>
	</p>

	<p class="note">
		Preview any look without saving it: <code>?theme=night&amp;pieces=nocturne&amp;font=geometric</code> on any page;
		<code>?mode=light</code> flips whichever theme is chosen; <code>?board=material</code> puts another family's board
		treatment under it.
	</p>
</main>

<style>
	main {
		/* The page's own type never changes: trying a theme on must not move the option you are about to
		   click. Each theme's typeface is shown inside its swatch instead. */
		--font-ui: 'Instrument Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
		--font-display: 'Instrument Serif', Georgia, 'Times New Roman', serif;
		--font-num: var(--font-ui);
		/* Inheritance passes the resolved family, so the page must re-read the token it just pinned. */
		font-family: var(--font-ui);
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

	.note {
		margin: 0.6rem 0 0;
		font-size: 0.85rem;
		color: var(--text-3);
	}

	section {
		margin-bottom: 2rem;
	}

	.collection {
		margin: 0.8rem 0 0.4rem;
		font-size: 0.85rem;
		color: var(--text-2);
	}

	/* Two halves of one control, the same height whatever theme is on. */
	.mode {
		display: inline-flex;
		margin: 0.6rem 0 0.8rem;
		padding: 3px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface-1);
	}

	.mode-option {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 5rem;
		height: 2rem;
		padding: 0 1rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--text-2);
		font-size: 0.9rem;
		font-weight: 500;
		line-height: 1;
	}

	.mode-option:hover {
		color: var(--text);
	}

	.mode-option.active {
		background: var(--surface-2);
		color: var(--text);
		box-shadow: 0 0 0 1px var(--accent);
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

	/* A sample in the pairing itself; fixed height, so choosing one never moves the page. */
	/* The note sits under the name here: these labels are sentences, not a word and a tag. */
	.font-option .label {
		flex-direction: column;
		align-items: flex-start;
		gap: 0.1rem;
	}

	.font-option small {
		text-align: left;
	}

	.type-sample {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.15rem;
		height: 5.4rem;
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface-1);
		overflow: hidden;
	}

	.type-sample b {
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 400;
		line-height: 1.5rem;
		color: var(--text);
	}

	.type-sample i {
		font-family: var(--font-ui);
		font-size: 0.75rem;
		font-style: normal;
		line-height: 1.1rem;
		color: var(--text-2);
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
