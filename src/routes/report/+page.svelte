<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { version } from '$app/environment';
	import { MAX_BODY } from '$lib/report';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	/**
	 * Deliberately the *initial* value only. With JavaScript the enhanced submit keeps what is in the box;
	 * without it a rejected POST re-renders the page, and this is what stops the reporter's words being
	 * thrown away by a validation error.
	 */
	let body = $state(untrack(() => (form as { body?: string } | null)?.body ?? ''));
	let kind = $state(untrack(() => (form as { kind?: string } | null)?.kind ?? 'bug'));
	let sending = $state(false);

	const left = $derived(MAX_BODY - body.length);

	/**
	 * What the page can say for itself, so the reporter does not have to. Filled in on mount and shown
	 * to them before they send it — collected, not extracted.
	 */
	let viewport = $state('');
	$effect(() => {
		viewport = `${window.innerWidth}×${window.innerHeight}${window.devicePixelRatio > 1 ? ` @${window.devicePixelRatio}x` : ''}`;
	});

	const KINDS = [
		{ id: 'bug', label: 'Something is broken', hint: 'It crashed, looked wrong, or did the wrong thing.' },
		{ id: 'idea', label: 'An idea', hint: 'Something that would make it better.' },
		{ id: 'other', label: 'Something else', hint: 'Anything that fits neither.' }
	];
</script>

<svelte:head>
	<title>Report a bug — Lethal Chess</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="prose">
	{#if form?.sent}
		<h1>Thank you</h1>
		<p class="lede">
			That has reached us. If you left a way to get hold of you, we may come back with questions — otherwise
			it goes straight onto the list.
		</p>
		<p class="actions">
			<a class="btn primary" href={data.from ?? '/'}>Back to the app</a>
			<button type="button" class="btn" onclick={() => location.reload()}>Report something else</button>
		</p>
	{:else}
		<h1>Report a bug</h1>
		<p class="lede">
			Anything that looked wrong, felt wrong, or got in your way. Half a sentence is worth more than
			nothing — you do not have to work out why it happened.
		</p>

		<form
			method="POST"
			use:enhance={() => {
				sending = true;
				return async ({ update }) => {
					await update({ reset: false });
					sending = false;
				};
			}}
		>
			<fieldset class="kinds">
				<legend>What kind of thing is it?</legend>
				{#each KINDS as k (k.id)}
					<label class="kind" class:on={kind === k.id}>
						<input type="radio" name="kind" value={k.id} bind:group={kind} />
						<span>
							<b>{k.label}</b>
							<small>{k.hint}</small>
						</span>
					</label>
				{/each}
			</fieldset>

			<label class="field">
				<span class="label">What happened?</span>
				<textarea
					name="body"
					bind:value={body}
					rows="8"
					maxlength={MAX_BODY}
					required
					placeholder={'What you did, what you expected, and what happened instead.\n\nFor example: "On my phone I opened the Italian Game map and pinched to zoom in. The left half of the map was cut off and I could not scroll to it."'}
				></textarea>
				<small class="count" class:low={left < 200}>{left.toLocaleString('en')} characters left</small>
			</label>

			{#if !data.signedIn}
				<label class="field">
					<span class="label">How can we reach you? <em>Optional</em></span>
					<input type="text" name="contact" maxlength="200" autocomplete="email" placeholder="Email or a name — or leave it blank" />
				</label>
			{/if}

			<!-- Sent with the report, and shown here first: nothing goes that is not on this page. -->
			<input type="hidden" name="path" value={data.from ?? ''} />
			<input type="hidden" name="viewport" value={viewport} />
			<input type="hidden" name="appVersion" value={version} />

			<details class="context">
				<summary>What gets sent with this</summary>
				<ul>
					<li><b>Your words above</b>, exactly as you wrote them.</li>
					{#if data.signedIn}<li><b>Your account</b>, so we know who to thank — you are signed in as {data.name}.</li>{/if}
					{#if data.from}<li><b>The page you came from</b>: <code>{data.from}</code></li>{/if}
					<li><b>Your window size</b>: {viewport || '—'}</li>
					<li><b>Your browser's name and version</b>, and which build of the site you are on.</li>
				</ul>
				<p>Nothing else. No screenshot, no moves, no location.</p>
			</details>

			{#if form?.error}
				<p class="error" role="alert">{form.error}</p>
			{/if}

			<p class="actions">
				<button type="submit" class="btn primary" disabled={sending || body.trim().length < 4}>
					{sending ? 'Sending…' : 'Send report'}
				</button>
				<a class="btn" href={data.from ?? '/'}>Cancel</a>
			</p>
		</form>
	{/if}
</main>

<style>
	main {
		width: 100%;
		max-width: 46rem;
		margin: 0 auto;
		padding: 2rem 1.25rem 4rem;
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 2.2rem;
	}

	.lede {
		margin: 0.5rem 0 1.75rem;
		color: var(--text-2);
	}

	form {
		display: grid;
		gap: 1.5rem;
	}

	fieldset {
		display: grid;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		border: 0;
	}

	legend,
	.label {
		display: block;
		margin-bottom: 0.45rem;
		padding: 0;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-2);
	}

	.label em {
		font-style: normal;
		font-weight: 400;
		color: var(--text-3);
	}

	.kind {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		padding: 0.7rem 0.85rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface-1);
		cursor: pointer;
	}

	.kind.on {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 10%, var(--surface-1));
	}

	.kind input {
		margin: 0.25rem 0 0;
		accent-color: var(--accent);
	}

	.kind b {
		display: block;
		font-weight: 600;
	}

	.kind small {
		color: var(--text-3);
	}

	.field {
		display: block;
	}

	textarea,
	input[type='text'] {
		display: block;
		width: 100%;
		padding: 0.7rem 0.85rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface-1);
		color: var(--text);
		font: inherit;
		line-height: 1.5;
		resize: vertical;
	}

	textarea::placeholder {
		color: var(--text-3);
	}

	textarea:focus-visible,
	input[type='text']:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	.count {
		display: block;
		margin-top: 0.35rem;
		text-align: right;
		color: var(--text-3);
		font-size: 0.8rem;
	}

	.count.low {
		color: var(--accent);
	}

	.context {
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.6rem 0.85rem;
		color: var(--text-2);
		font-size: 0.9rem;
	}

	.context summary {
		cursor: pointer;
		color: var(--text-2);
	}

	.context ul {
		margin: 0.6rem 0 0;
		padding-left: 1.1rem;
	}

	.context li {
		margin: 0.2rem 0;
	}

	.context code {
		font-size: 0.85em;
	}

	.context p {
		margin: 0.6rem 0 0;
		color: var(--text-3);
	}

	.error {
		margin: 0;
		padding: 0.6rem 0.85rem;
		border-radius: 10px;
		border: 1px solid color-mix(in srgb, var(--bad) 50%, var(--border));
		background: color-mix(in srgb, var(--bad) 12%, var(--surface-1));
		color: var(--text);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		margin: 0;
	}

	.actions .btn {
		text-decoration: none;
	}
</style>
