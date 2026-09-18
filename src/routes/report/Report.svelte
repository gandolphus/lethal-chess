<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { version } from '$app/environment';
	import { clearDraft, MAX_BODY, ownPath, readDraft, writeDraft, type ReportKind } from '$lib/report';

	/**
	 * The report form, drawn either on its own page or in a layer over the page it is about. `from` is
	 * that page: the page's `?from=` on a cold arrival, the page beneath when layered. `form` is the
	 * server's answer to a submit without JavaScript, which re-renders the page with it; with JavaScript
	 * the answer arrives through `enhance` and is kept here, so a layer that closes and opens again
	 * starts clean rather than thanking twice. `onclose` is the way back when there is no page to go to.
	 */
	let {
		from,
		signedIn,
		name,
		form = null,
		layered = false,
		onclose
	}: {
		from: string | null;
		signedIn: boolean;
		name: string | null;
		form?: { sent?: boolean; error?: string; body?: string; kind?: string; contact?: string } | null;
		layered?: boolean;
		onclose?: () => void;
	} = $props();

	const storage = () => globalThis.sessionStorage;

	/**
	 * Deliberately the *initial* value only. A rejected submit without JavaScript re-renders the page
	 * with what was typed; otherwise the draft this tab kept, if the form was closed mid-sentence.
	 */
	const initial = untrack(() => (form?.body != null ? null : readDraft(storage())));
	let body = $state(untrack(() => form?.body ?? initial?.body ?? ''));
	let kind = $state<ReportKind>(untrack(() => (form?.kind as ReportKind | undefined) ?? initial?.kind ?? 'bug'));
	let contact = $state(untrack(() => form?.contact ?? initial?.contact ?? ''));
	let sending = $state(false);
	let sent = $state(untrack(() => form?.sent ?? false));
	let error = $state<string | null>(untrack(() => form?.error ?? null));

	// The submit button is disabled while sending, which drops focus on the floor; after the answer it
	// goes to the next thing to do — the way back, or the button to try again.
	let doneButton = $state<HTMLElement | null>(null);
	let sendButton = $state<HTMLElement | null>(null);
	async function settle() {
		await tick();
		(sent ? doneButton : sendButton)?.focus();
	}

	const left = $derived(MAX_BODY - body.length);
	// Never the address bar's word for it: only a path within this site is written on the form.
	const page = $derived(ownPath(from));

	// Closing must never be the thing that loses a report; the tab keeps it until it is sent.
	$effect(() => {
		writeDraft(storage(), { kind, body, contact });
	});

	/**
	 * What the page can say for itself, so the reporter does not have to. Filled in on mount and shown
	 * to them before they send it — collected, not extracted.
	 */
	let viewport = $state('');
	$effect(() => {
		viewport = `${window.innerWidth}×${window.innerHeight}${window.devicePixelRatio > 1 ? ` @${window.devicePixelRatio}x` : ''}`;
	});

	function another() {
		sent = false;
		error = null;
		body = '';
		kind = 'bug';
		contact = '';
	}

	const KINDS = [
		{ id: 'bug', label: 'Something is broken', hint: 'It crashed, looked wrong, or did the wrong thing.' },
		{ id: 'idea', label: 'An idea', hint: 'Something that would make it better.' },
		{ id: 'other', label: 'Something else', hint: 'Anything that fits neither.' }
	];
</script>

<div class="report">
	{#if sent}
		<h2 class="thanks">Thank you</h2>
		<p class="lede">
			That has reached us. If you left a way to get hold of you, we may come back with questions — otherwise
			it goes straight onto the list.
		</p>
		<p class="actions">
			{#if layered}
				<button type="button" class="btn primary" bind:this={doneButton} onclick={onclose}>Back to the app</button>
			{:else}
				<a class="btn primary" href={page ?? '/'} bind:this={doneButton}>Back to the app</a>
			{/if}
			<button type="button" class="btn" onclick={another}>Report something else</button>
		</p>
	{:else}
		<p class="lede">
			Anything that looked wrong, felt wrong, or got in your way. Half a sentence is worth more than
			nothing — you do not have to work out why it happened.
		</p>

		<!-- The action is named because a layer's address is the page beneath it. The answer is kept here
		     rather than applied to the page: applying a success would re-run the load functions of whatever
		     the form is over, and applying a server error would replace that page with the error page — a
		     drill lost to a bug report about it. Either way the words stay in the box. -->
		<form
			method="POST"
			action="/report"
			use:enhance={() => {
				sending = true;
				return async ({ result, update }) => {
					sending = false;
					if (result.type === 'success') {
						sent = true;
						error = null;
						clearDraft(storage());
						body = '';
						contact = '';
					} else if (result.type === 'failure') {
						error = (result.data as { error?: string } | undefined)?.error ?? 'That did not go through — please try again.';
					} else if (result.type === 'error') {
						error = 'Something went wrong at our end. Your words are still here — please try again in a minute.';
					} else {
						return update({ reset: false, invalidateAll: false });
					}
					await settle();
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

			{#if !signedIn}
				<label class="field">
					<span class="label">How can we reach you? <em>Optional</em></span>
					<input
						type="text"
						name="contact"
						bind:value={contact}
						maxlength="200"
						autocomplete="email"
						placeholder="Email or a name — or leave it blank"
					/>
				</label>
			{/if}

			<!-- Sent with the report, and shown here first: nothing goes that is not on this page. -->
			<input type="hidden" name="path" value={page ?? ''} />
			<input type="hidden" name="viewport" value={viewport} />
			<input type="hidden" name="appVersion" value={version} />

			<details class="context">
				<summary>What gets sent with this</summary>
				<ul>
					<li><b>Your words above</b>, exactly as you wrote them.</li>
					{#if signedIn}<li><b>Your account</b>, so we know who to thank — you are signed in as {name}.</li>{/if}
					{#if page}<li><b>The page {layered ? 'you are on' : 'you came from'}</b>: <code>{page}</code></li>{/if}
					<li><b>Your window size</b>: {viewport || '—'}</li>
					<li><b>Your browser's name and version</b>, and which build of the site you are on.</li>
				</ul>
				<p>Nothing else. No screenshot, no moves, no location.</p>
			</details>

			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}

			<p class="actions">
				<button type="submit" class="btn primary" bind:this={sendButton} disabled={sending || body.trim().length < 4}>
					{sending ? 'Sending…' : 'Send report'}
				</button>
				<!-- A layer has Close in its own bar; here Cancel is the way back, and it keeps the draft too. -->
				{#if !layered}
					<a class="btn" href={page ?? '/'}>Cancel</a>
				{/if}
			</p>
		</form>
	{/if}
</div>

<style>
	.report {
		width: 100%;
		max-width: 46rem;
	}

	.thanks {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.6rem;
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
