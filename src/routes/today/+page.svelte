<script lang="ts">
	import { onMount } from 'svelte';
	import Board from '$lib/components/Board.svelte';
	import { Game } from '$lib/chess/game.svelte';
	import { progressStore, sync } from '$lib/drill/account.svelte';
	import type { Bundle } from '$lib/drill/bundle';
	import { Book, stagesOf } from '$lib/explore/book';
	import { lineCards, reviewable, type ReviewRating } from '$lib/explore/mastery';
	import { ReviewSession } from '$lib/explore/review.svelte';
	import { planToday, type TodayItem } from '$lib/explore/today';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const startFen = new Game().fen;

	let plan = $state<TodayItem[] | null>(null);
	let index = $state(0);
	let review = $state<ReviewSession | null>(null);
	let results = $state<ReviewRating[]>([]);
	let nextDue = $state<Date | null>(null);
	let failed = $state<string | null>(null);

	const books = new Map<string, Book>();

	onMount(() => {
		void load().catch((error) => (failed = (error as Error).message));
	});

	/** Every opening with discovered lines contributes its due lines; bundles are fetched only for those. */
	async function load() {
		const store = progressStore(data.user?.id ?? null);
		const now = new Date();
		const found = await Promise.all(
			data.openings.map(async (opening) => ({ opening, discoveries: await store.loadDiscoveries(opening.id) }))
		);
		const openings = await Promise.all(
			found
				.filter(({ discoveries }) => discoveries.some((d) => d.stage === 'discovered'))
				.map(async ({ opening, discoveries }) => {
					const response = await fetch(`/openings/repertoires/${opening.id}.json`);
					if (!response.ok) throw new Error(`Could not load the ${opening.name} (${response.status})`);
					const bundle: Bundle = await response.json();
					const book = new Book(bundle);
					books.set(bundle.id, book);
					const lines = reviewable(book, stagesOf(discoveries), (bundle.openingMoves ?? []).length, bundle.side);
					return { bundle, lines, cards: lineCards(await store.loadReviews(bundle.id)) };
				})
		);
		for (const { lines, cards } of openings) {
			for (const line of lines) {
				const due = cards.get(line.key)?.due;
				if (due && due > now && (!nextDue || due < nextDue)) nextDue = due;
			}
		}
		plan = planToday(openings, now);
		if (plan.length) await begin(0);
	}

	async function begin(i: number) {
		if (!plan) return;
		index = i;
		const item = plan[i];
		const store = progressStore(data.user?.id ?? null);
		const next = new ReviewSession({
			bundle: item.bundle,
			book: books.get(item.bundle.id)!,
			line: item.line,
			card: item.card,
			onAttempt: (attempt) => void store.recordAttempt(attempt),
			onReview: (lineReview) => {
				results = [...results, lineReview.rating];
				void store.recordReview(lineReview);
			}
		});
		review = next;
		await next.start();
	}

	const finished = $derived(Boolean(plan && plan.length && results.length === plan.length && review?.phase === 'done'));
	const item = $derived(plan?.[index] ?? null);

	function dueIn(due: Date) {
		const days = Math.round((due.getTime() - Date.now()) / 86_400_000);
		return days < 1 ? 'later today' : days === 1 ? 'tomorrow' : `in ${days} days`;
	}

	const WORDS = { good: 'Remembered', hard: 'Remembered, with effort', again: 'Not remembered yet' } as const;

	const notice = $derived.by((): { tone?: 'pass' | 'soft' | 'fail' | 'wait'; title: string; text: string } => {
		if (failed) return { tone: 'fail', title: "Today's review couldn't load", text: failed };
		if (!plan) return { tone: 'wait', title: 'Gathering your lines…', text: '' };
		if (!plan.length) {
			return {
				tone: 'pass',
				title: 'Nothing due today',
				text: nextDue
					? `Every line you've discovered is fresh in memory. The next one comes back ${dueIn(nextDue)}.`
					: 'Today replays the lines you discover, across all your openings. Explore an opening to find your first.'
			};
		}
		if (finished) {
			const remembered = results.filter((r) => r !== 'again').length;
			return {
				tone: 'pass',
				title: "That's today done",
				text: `${remembered} of ${results.length} lines remembered. The ones you missed come back soon; the rest when you're about to forget them.`
			};
		}
		if (!review) return { tone: 'wait', title: 'Loading…', text: '' };
		const message = review.message;
		switch (review.phase) {
			case 'opponent':
				return { tone: 'wait', title: 'Opponent is moving…', text: message?.text ?? '' };
			case 'await':
				return { title: 'Your move — from memory', text: message?.text ?? 'Replay a line you discovered. How does it continue?' };
			case 'retry':
				return { tone: message?.tone === 'soft' ? 'soft' : 'fail', title: 'One more try', text: message?.text ?? '' };
			case 'reveal':
				return { title: 'Play the highlighted move', text: message?.text ?? '' };
			case 'done':
				return {
					tone: review.result!.rating === 'again' ? 'soft' : 'pass',
					title: WORDS[review.result!.rating],
					text: `${review.line.name}. It comes back ${dueIn(review.result!.due)}.`
				};
		}
	});

	function onKey(event: KeyboardEvent) {
		if (event.metaKey || event.ctrlKey || event.altKey || !review || !plan) return;
		if (event.key === 'n' && review.phase === 'done' && index + 1 < plan.length) void begin(index + 1);
		else if (event.key === 'h' && ['await', 'retry'].includes(review.phase)) review.hint();
	}
</script>

<svelte:head>
	<title>Today — Lethal Chess</title>
</svelte:head>

<svelte:window onkeydown={onKey} />

<main>
	<div class="layout">
		<div class="board-slot">
			{#if review && !finished}
				<Board
					fen={review.game.fen}
					orientation={review.bundle.side}
					interactive={['await', 'retry', 'reveal'].includes(review.phase)}
					legalTargets={review.game.legalTargets}
					needsPromotion={review.game.needsPromotion}
					marks={review.marks}
					arrows={review.arrows}
					onMove={(from, to, promotion) => void review?.submit(from, to, promotion)}
				/>
			{:else}
				<Board fen={review?.game.fen ?? startFen} orientation={review?.bundle.side ?? 'w'} interactive={false} onMove={() => {}} />
			{/if}
		</div>

		<aside class="panel">
			<header>
				<p class="kicker">Today</p>
				<h1>{item && !finished ? item.bundle.name : 'Daily review'}</h1>
				{#if item && !finished}
					<p class="sub">You play {item.bundle.side === 'w' ? 'White' : 'Black'} · line {index + 1} of {plan?.length} · name hidden until the end</p>
				{:else}
					<p class="sub">The lines you've discovered, across every opening, each when it's due.</p>
				{/if}
			</header>

			{#if plan?.length}
				<ol class="session" aria-label="Today's lines">
					{#each plan as _, i (i)}
						<li data-state={results[i] ?? (i === index && !finished ? 'current' : 'todo')} title={results[i] ? WORDS[results[i]] : undefined}></li>
					{/each}
				</ol>
			{/if}

			<div class="notice" data-tone={notice.tone} aria-live="polite">
				<p class="title">{notice.title}</p>
				{#if notice.text}<p class="text">{notice.text}</p>{/if}
				<div class="actions">
					{#if review && !finished && (review.phase === 'await' || review.phase === 'retry')}
						<button type="button" class="btn" onclick={() => review?.hint()}>{review.hintLevel === 0 ? 'Hint' : 'Show the move'} <kbd>H</kbd></button>
					{/if}
					{#if review?.phase === 'done' && plan && index + 1 < plan.length}
						<button type="button" class="btn primary" onclick={() => begin(index + 1)}>Next line <kbd>N</kbd></button>
					{/if}
					{#if finished || (plan && !plan.length)}
						<a class="btn primary" href="/">Explore an opening</a>
					{/if}
				</div>
			</div>

			<p class="save" role="status">
				{#if sync.status === 'synced'}Saved to your account.{:else if sync.status === 'pending'}Saving…{:else if sync.status === 'offline'}Offline — kept on this device.{:else if sync.status === 'signed-out'}Session ended — kept on this device.{:else}Saved in this browser.{/if}
			</p>
		</aside>
	</div>
</main>

<style>
	main {
		max-width: 1180px;
		margin: 0 auto;
		padding: 1.25rem 1.25rem 3rem;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
		gap: 2rem;
		align-items: start;
	}

	.board-slot {
		width: min(78vh, 100%);
		justify-self: center;
		position: sticky;
		top: 1rem;
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	.kicker {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--accent);
	}

	h1 {
		margin: 0.15rem 0 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.9rem;
		line-height: 1.1;
	}

	.sub {
		margin: 0.3rem 0 0;
		font-size: 0.88rem;
		color: var(--text-2);
	}

	.session {
		display: flex;
		gap: 4px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.session li {
		flex: 1;
		max-width: 2.2rem;
		height: 6px;
		border-radius: 3px;
		background: var(--surface-2);
		box-shadow: 0 0 0 1px var(--border) inset;
	}

	.session li[data-state='current'] {
		background: color-mix(in srgb, var(--accent) 45%, var(--surface-2));
	}

	.session li[data-state='good'] {
		background: var(--ok);
	}

	.session li[data-state='hard'] {
		background: color-mix(in srgb, var(--ok) 55%, var(--soft));
	}

	.session li[data-state='again'] {
		background: var(--soft);
	}

	.notice .title {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 600;
	}

	.notice .text {
		margin: 0.35rem 0 0;
		color: var(--text-2);
		line-height: 1.45;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.8rem;
	}

	.actions:empty {
		display: none;
	}

	.save {
		margin: 0;
		font-size: 0.78rem;
		color: var(--text-3);
	}

	@media (max-width: 860px) {
		main {
			padding: 0.75rem 0.75rem 2.5rem;
		}

		.layout {
			grid-template-columns: 1fr;
			gap: 0.9rem;
		}

		.board-slot {
			position: static;
			width: 100%;
		}

		h1 {
			font-size: 1.5rem;
		}
	}
</style>
