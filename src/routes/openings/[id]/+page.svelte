<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Game } from '$lib/chess/game.svelte';
	import { progressStore, sync } from '$lib/drill/account.svelte';
	import { Book, stagesOf, summarize, type DiscoverySummary, type IndexedLine, type LineStage } from '$lib/explore/book';
	import { ago, dueIn, promote, shortName, standing, statusOf, type Approach, type Standing } from '$lib/explore/dashboard';
	import { lineCards } from '$lib/explore/mastery';
	import LineMap from '$lib/ui/LineMap.svelte';
	import LineShelf from '$lib/ui/LineShelf.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const bundle = $derived(data.bundle);
	const book = $derived(new Book(bundle));
	const openingLength = $derived((bundle.openingMoves ?? []).length);

	const openingSan = $derived.by(() => {
		const preview = new Game();
		preview.load(bundle.openingMoves ?? bundle.rootMoves);
		return preview.history.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}.${san}` : san)).join(' ');
	});


	// Facts about the opening itself, not about the learner: how much there is and how it is grouped.
	const facts = $derived.by(() => {
		const sound = book.lines.filter((l) => !l.dubious);
		const variations = new Set(sound.map((l) => l.variation)).size;
		const dubious = book.lines.length - sound.length;
		return `${sound.length} lines in ${variations} variations${dubious ? ` · ${dubious} dubious` : ''}`;
	});

	let stand = $state<Standing | null>(null);
	let stages = $state<Map<string, LineStage>>(new Map());
	let summary = $state<DiscoverySummary | null>(null);
	let map = $state<{ band: string | null } | null>(null);
	let narrow = $state(false);

	onMount(() => {
		const phone = matchMedia('(max-width: 860px)');
		const sync = () => (narrow = phone.matches);
		sync();
		phone.addEventListener('change', sync);
		onDestroy(() => phone.removeEventListener('change', sync));
		void load();
	});

	async function load() {
		const store = progressStore(data.user?.id ?? null);
		const [discoveries, reviews] = await Promise.all([store.loadDiscoveries(bundle.id), store.loadReviews(bundle.id)]);
		stages = stagesOf(discoveries);
		summary = summarize(book, stages);
		stand = standing(book, discoveries, lineCards(reviews), openingLength, bundle.side, new Date());
	}

	const now = new Date();
	const lead = $derived<Approach>(stand ? promote(stand) : 'explore');

	const APPROACHES: { id: Approach; name: string; blurb: string; action: string; key: string }[] = [
		{ id: 'explore', name: 'Explore', blurb: 'The lines are secret. Find them by playing good moves.', action: 'Explore', key: 'E' },
		{ id: 'practice', name: 'Practice', blurb: 'Replay the lines you found, from memory, before they fade.', action: 'Practice', key: 'P' },
		{ id: 'open', name: 'The Open', blurb: 'Play the opening against someone who might play anything. Answer every move precisely.', action: 'Enter', key: 'O' }
	];

	const href = (approach: Approach) => `/openings/${bundle.id}/${approach}`;

	/** A found line on the map is played from: Explore picks it up at its end. */
	const play = (line: IndexedLine) => void goto(`/openings/${bundle.id}/explore?line=${encodeURIComponent(line.key)}`);

	function onKey(event: KeyboardEvent) {
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if ((event.target as HTMLElement | null)?.closest('input, textarea, select')) return;
		if (event.key === 'e') void goto(href('explore'));
		else if (event.key === 'p') void goto(href('practice'));
		else if (event.key === 'o') void goto(href('open'));
		else if (event.key === 'm' && narrow) map = map ? null : { band: null };
	}
</script>

<svelte:head>
	<title>{bundle.name} — Lethal Chess</title>
</svelte:head>

<svelte:window onkeydown={onKey} />

<main>
	<div class="layout">
		<!-- The territory: the opening as a map, lit where this learner has been. On a phone it is a sheet. -->
		{#if !narrow}
			<section class="territory" aria-label="The lines">
				<LineMap side={bundle.side} lines={book.lines} {stages} here={null} opening={openingLength} title="The lines" onplay={play} />
			</section>
		{/if}

		<aside class="panel">
			<header>
				<p class="side"><i class="stone" class:black={bundle.side === 'b'}></i>You play {bundle.side === 'w' ? 'White' : 'Black'}</p>
				<h1 class="pick-text">{bundle.name}</h1>
				<p class="opening num pick-text">{openingSan}</p>
				<p class="facts">{facts}</p>
			</header>

			<!-- Where you stand. Two headline figures: how ready you are to play it, and how much of it you have found.
			     The readiness rating comes from The Open, which is not built: the slot shows its empty state, never a value. -->
			<dl class="standing" class:loading={!stand}>
				<div class="headline">
					<dt>Readiness</dt>
					<dd class="num"><strong class="unrated">—</strong></dd>
					<dd class="sub">unrated · play The Open</dd>
				</div>
				<div class="headline">
					<dt>Found</dt>
					<dd class="num"><strong>{stand?.discovered ?? '–'}</strong><span>{' / '}{stand?.total ?? book.lines.filter((l) => !l.dubious).length}</span></dd>
					<dd class="sub">{stand?.entered ? `${stand.entered} entered, unfinished` : 'established lines'}</dd>
				</div>
				<div class="small">
					<dt>Remembered</dt>
					<dd class="num">{stand?.remembered ?? '–'}<span>{' / '}{stand?.discovered ?? '–'}</span>{#if stand?.mastered}<span>{' · '}{stand.mastered} mastered</span>{/if}</dd>
				</div>
				<div class="small">
					<dt>Due</dt>
					<dd class="num">{stand?.due ?? '–'}<span>{' '}{stand?.due ? 'to replay now' : stand?.nextDue ? `· next ${dueIn(stand.nextDue, now)}` : '· nothing waiting'}</span></dd>
				</div>
			</dl>

			{#if stand?.lastFound}
				<p class="last">Last found: <b>{shortName(stand.lastFound.line.name)}</b> · {ago(stand.lastFound.at, now)}</p>
			{/if}

			{#if narrow && summary}
				<div class="shelf-row">
					<LineShelf variations={summary.variations} onopen={(band) => (map = { band })} />
					<button type="button" class="btn small" onclick={() => (map = { band: null })}>Map</button>
				</div>
			{/if}

			<!-- The choice. One card leads; it is the one the numbers point at. -->
			<ul class="approaches" aria-label="Ways to work on this opening">
				{#each APPROACHES as approach (approach.id)}
					{@const leads = approach.id === lead}
					<li class="approach" class:leads>
						<div class="words">
							<p class="name">{approach.name}</p>
							<p class="blurb">{approach.blurb}</p>
							<p class="status" class:lit={leads}>{stand ? statusOf(approach.id, stand, now) : '…'}</p>
						</div>
						<a class="btn" class:primary={leads} href={href(approach.id)}>{approach.action} <kbd>{approach.key}</kbd></a>
					</li>
				{/each}
			</ul>

			<p class="save" data-status={sync.status ?? 'local'} role="status">
				{#if sync.status === 'synced'}Saved to your account.{:else if sync.status === 'pending'}Saving…{:else if sync.status === 'offline'}Offline — kept on this device.{:else if sync.status === 'signed-out'}Session ended — kept on this device. <a href="/auth/google">Sign in</a> to save it.{:else}Saved in this browser. <a href="/auth/google">Sign in</a> to keep it everywhere.{/if}
			</p>
		</aside>
	</div>
</main>

<!-- On a phone the map is the bottom sheet it is on the playing screen. -->
{#if map}
	<button type="button" class="map-scrim" aria-label="Close the map" onclick={() => (map = null)}></button>
	<div class="map-sheet" role="dialog" aria-modal="true" aria-label="Line map">
		<LineMap
			side={bundle.side}
			lines={book.lines}
			{stages}
			here={null}
			opening={openingLength}
			title="{bundle.name} — the lines"
			band={map.band}
			onclose={() => (map = null)}
			onplay={play}
		/>
	</div>
{/if}

<style>
	main {
		/* The screen fills what the shell leaves; the footer sits under it, not past the bottom of it. */
		flex: 1;
		min-height: 0;
		width: 100%;
		max-width: var(--page-max);
		margin: 0 auto;
		padding: 1.25rem;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(var(--panel-min), var(--panel-max));
		gap: var(--page-gap);
		align-items: start;
	}

	/* Where a playing screen has its board, the dashboard has the map, as tall as the frame allows. */
	.territory {
		height: calc(100dvh - var(--chrome));
		min-height: 0;
		border: 1px solid var(--border);
		border-radius: 12px;
		overflow: hidden;
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		/* Never the reason the window scrolls: past the frame's height the panel scrolls inside itself. */
		max-height: calc(100dvh - var(--chrome));
		overflow-y: auto;
		scrollbar-gutter: stable;
	}

	.side {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin: 0;
		font-size: 0.85rem;
		color: var(--text-2);
	}

	.stone {
		flex: none;
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 50%;
		background: var(--pw1);
		box-shadow: 0 0 0 1.5px var(--pws) inset;
	}

	.stone.black {
		background: var(--pb2);
		box-shadow: 0 0 0 1.5px var(--pbh) inset;
	}

	h1 {
		margin: 0.15rem 0 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.9rem;
		line-height: 1.1;
		letter-spacing: -0.01em;
	}

	.opening {
		margin: 0.2rem 0 0;
		font-size: 0.85rem;
		color: var(--text-3);
	}

	.facts {
		margin: 0.35rem 0 0;
		font-size: 0.8rem;
		color: var(--text-3);
	}

	/* Two headline figures on the first row, two states on the second. */
	.standing {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.55rem 0.8rem;
		margin: 0;
		padding: 0.7rem 0;
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
	}

	.standing dt {
		font-size: 0.78rem;
		color: var(--text-2);
	}

	.standing dd {
		margin: 0;
	}

	.standing .num {
		margin-top: 0.1rem;
		line-height: 1;
		white-space: nowrap;
	}

	.standing strong {
		font-family: var(--font-display);
		font-size: 1.9rem;
		font-weight: 400;
		color: var(--text);
	}

	/* No rating yet: the figure is drawn as the absence of one, in the same size the number will have. */
	.standing .unrated,
	.standing.loading strong {
		color: var(--text-3);
	}

	.standing .num span {
		font-size: 0.85rem;
		color: var(--text-3);
	}

	.standing .sub {
		margin-top: 0.3rem;
		font-size: 0.72rem;
		line-height: 1.25;
		color: var(--text-3);
	}

	.standing .small {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		padding-top: 0.45rem;
		border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
	}

	.standing .small dt {
		font-size: 0.75rem;
	}

	.standing .small .num {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 500;
	}

	.standing .small .num span {
		font-size: 0.75rem;
		font-weight: 400;
	}

	.last {
		margin: -0.3rem 0 0;
		font-size: 0.85rem;
		color: var(--text-2);
	}

	.last b {
		font-weight: 500;
		color: var(--text);
	}

	.approaches {
		display: grid;
		gap: 0.6rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.approach {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.9rem;
		align-items: center;
		padding: 0.65rem 0.8rem 0.65rem 1rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface-1);
	}

	/* The card that leads carries the rule a notice does: the one place the page points. */
	.approach.leads::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0.7rem;
		bottom: 0.7rem;
		width: 3px;
		border-radius: 2px;
		background: var(--accent);
		box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 45%, transparent);
	}

	.approach.leads {
		border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
	}

	/* The whole card is the target, not just the button on it. The button's own anchor is stretched over
	   the card rather than a second link being added, so there is still one thing to tab to and one thing
	   a screen reader announces. */
	.approach:has(a) {
		cursor: pointer;
	}

	/* This resolves against the card because nothing on the link establishes a containing block. A
	   `filter`, `transform` or `backdrop-filter` on the link — even only on hover — would make it one,
	   and the overlay would collapse onto the button. */
	.approach a.btn::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 10px;
	}

	.approach:has(a:hover) {
		border-color: var(--text-3);
		background: var(--surface-2);
	}

	.approach:has(a:focus-visible) {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	.words p {
		margin: 0;
	}

	.name {
		font-weight: 600;
	}

	/* The status line is what this approach would do for this learner today; it is always there. The
	   sentence about the approach in general is shown only where the window has the height for it. */
	.blurb {
		display: none;
		margin-top: 0.15rem !important;
		font-size: 0.82rem;
		line-height: 1.35;
		color: var(--text-2);
	}

	@media (min-height: 800px) and (min-width: 861px) {
		.blurb {
			display: block;
		}
	}

	.status {
		margin-top: 0.2rem !important;
		font-size: 0.82rem;
		line-height: 1.35;
		color: var(--text-2);
	}

	.status.lit {
		color: var(--accent);
	}

	.approach .btn {
		white-space: nowrap;
	}

	.save {
		margin: 0;
		font-size: 0.78rem;
		color: var(--text-3);
	}

	.shelf-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.shelf-row > :global(.shelf) {
		flex: 1;
		margin-top: 0;
	}

	/* The line map over the page. */
	.map-scrim {
		position: fixed;
		inset: 0;
		z-index: 40;
		padding: 0;
		border: 0;
		background: color-mix(in srgb, var(--bg) 72%, transparent);
		backdrop-filter: blur(3px);
		cursor: default;
	}

	.map-sheet {
		position: fixed;
		inset: auto 0 0 0;
		height: 82dvh;
		z-index: 41;
		border: 1px solid var(--border);
		border-bottom: 0;
		border-radius: 14px 14px 0 0;
		background: var(--surface-1);
		box-shadow: 0 40px 80px -30px rgba(0, 0, 0, 0.6);
		overflow: hidden;
	}

	@media (max-width: 860px) {
		main {
			padding: 0.6rem 0.75rem 0.5rem;
		}

		.layout {
			grid-template-columns: 1fr;
			gap: 0.65rem;
		}

		.panel {
			gap: 0.7rem;
			max-height: none;
			overflow: visible;
		}

		h1 {
			font-size: 1.5rem;
		}

		.facts {
			margin-top: 0.2rem;
		}

		.standing {
			padding: 0.6rem 0;
		}

		.standing strong {
			font-size: 1.6rem;
		}

		.approaches {
			gap: 0.5rem;
		}

		.approach {
			padding: 0.6rem 0.75rem 0.6rem 0.85rem;
		}

		/* Thumb-sized. */
		.approach .btn {
			min-height: 2.6rem;
		}
	}
</style>
