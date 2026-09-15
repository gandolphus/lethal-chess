<script lang="ts">
	import { onMount } from 'svelte';
	import Board from '$lib/components/Board.svelte';
	import { Engine, ignoreDestroyed } from '$lib/chess/engine';
	import { Game } from '$lib/chess/game.svelte';
	import { FreePlay } from '$lib/coach/freeplay.svelte';
	import { progressStore, sync } from '$lib/drill/account.svelte';
	import type { ProgressStore } from '$lib/drill/progress';
	import { toEpd } from '$lib/drill/tree';
	import { Book, stagesOf, summarize, type DiscoverySummary, type IndexedLine } from '$lib/explore/book';
	import { lineCards, mastery, nextLine, reviewable, type Mastery } from '$lib/explore/mastery';
	import { ReviewSession } from '$lib/explore/review.svelte';
	import { ExploreSession, type DiscoveryEvent } from '$lib/explore/session.svelte';
	import Meter from '$lib/ui/Meter.svelte';
	import { movePairs, SHARPNESS_WORDS, sharpnessLevel } from '$lib/ui/position';
	import type { PageProps } from './$types';

	type PageMode = 'explore' | 'practice';

	let { data }: PageProps = $props();
	const bundle = $derived(data.bundle);
	const book = $derived(new Book(bundle));

	// The start position, rendered on the server and until a session starts, so the board never flashes empty.
	const rootFen = new Game().fen;

	const openingSan = $derived.by(() => {
		const preview = new Game();
		preview.load(bundle.openingMoves ?? bundle.rootMoves);
		return preview.history.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}.${san}` : san)).join(' ');
	});

	let mode = $state<PageMode>('explore');
	let explore = $state<ExploreSession | null>(null);
	let review = $state<ReviewSession | null>(null);
	/** Practice found nothing due: how many lines could be replayed anyway. */
	let caughtUp = $state<{ lines: number } | null>(null);
	let memory = $state<Mastery | null>(null);
	let summary = $state<DiscoverySummary | null>(null);
	let store: ProgressStore | null = null;

	const activeStore = () => (store ??= progressStore(data.user?.id ?? null));

	async function refreshStats() {
		const s = activeStore();
		const [discoveries, reviews] = await Promise.all([s.loadDiscoveries(bundle.id), s.loadReviews(bundle.id)]);
		const stages = stagesOf(discoveries);
		summary = summarize(book, stages);
		memory = mastery(reviewable(book, stages, openingLength, bundle.side), lineCards(reviews), new Date());
	}

	const openingLength = $derived((bundle.openingMoves ?? []).length);

	// The engine (a 7 MB download) loads only when first needed: past the book, or for free play.
	let freeplay = $state<FreePlay | null>(null);
	let engine: Engine | null = null;
	let engineError = $state<string | null>(null);
	let engineLoading = $state(false);

	async function loadEngine(): Promise<Engine> {
		engine ??= new Engine();
		try {
			await engine.ready;
			return engine;
		} catch (error) {
			engine = null;
			throw error;
		}
	}

	async function keepPlaying() {
		if (!review || engineLoading) return;
		engineLoading = true;
		try {
			const ready = await loadEngine();
			const next = new FreePlay({ engine: ready, startMoves: review.game.uciHistory, side: bundle.side });
			freeplay = next;
			await next.start();
		} catch (error) {
			ignoreDestroyed(error);
			engineError = (error as Error).message;
		} finally {
			engineLoading = false;
		}
	}

	async function startExplore() {
		freeplay = null;
		review = null;
		caughtUp = null;
		mode = 'explore';
		const s = activeStore();
		const discoveries = await s.loadDiscoveries(bundle.id);
		const next = new ExploreSession({
			bundle,
			book,
			stages: stagesOf(discoveries),
			engine: loadEngine,
			onDiscovery: (discovery) => void s.recordDiscovery(discovery).then(refreshStats)
		});
		explore = next;
		await next.start();
	}

	/**
	 * Practice replays discovered lines from memory: the most overdue first, then lines never replayed.
	 * When nothing is due it says so; `anyway` replays a random discovered line regardless.
	 */
	async function startPractice(anyway = false) {
		freeplay = null;
		explore = null;
		review = null;
		mode = 'practice';
		const s = activeStore();
		const [discoveries, reviews] = await Promise.all([s.loadDiscoveries(bundle.id), s.loadReviews(bundle.id)]);
		// Oldest discovery first, so lines come back in the order they were found.
		const foundAt = new Map(discoveries.filter((d) => d.stage === 'discovered').map((d) => [d.line, d.at]));
		const lines = reviewable(book, stagesOf(discoveries), openingLength, bundle.side).sort((a, b) =>
			(foundAt.get(a.key) ?? '').localeCompare(foundAt.get(b.key) ?? '')
		);
		const cards = lineCards(reviews);
		const line = nextLine(lines, cards, new Date()) ?? (anyway && lines.length ? lines[Math.floor(Math.random() * lines.length)] : null);
		if (!line) {
			caughtUp = { lines: lines.length };
			return;
		}
		caughtUp = null;
		const next = new ReviewSession({
			bundle,
			book,
			line,
			card: cards.get(line.key),
			onAttempt: (attempt) => void s.recordAttempt(attempt),
			onReview: (lineReview) => void s.recordReview(lineReview).then(refreshStats)
		});
		review = next;
		await next.start();
	}

	const restart = () => (mode === 'explore' ? startExplore() : startPractice());

	onMount(() => {
		void startExplore();
		void refreshStats();
		return () => engine?.destroy();
	});

	const game = $derived(freeplay?.game ?? explore?.game ?? review?.game ?? null);
	const node = $derived(game ? bundle.nodes[toEpd(game.fen)] : undefined);
	const yourTurn = $derived(game ? game.turn === bundle.side : false);
	// A replayed line keeps its name hidden until it is done: recalling it is the exercise.
	const variationName = $derived(explore?.name ?? (review?.phase === 'done' ? review.line.name : null));

	/** "later today", "tomorrow", "in 6 days". */
	function dueIn(due: Date, now = new Date()) {
		const days = Math.round((due.getTime() - now.getTime()) / 86_400_000);
		return days < 1 ? 'later today' : days === 1 ? 'tomorrow' : `in ${days} days`;
	}

	const REVIEW_WORDS = { good: 'Remembered', hard: 'Remembered, with effort', again: 'Not remembered yet' } as const;

	const TONES = { best: 'pass', good: 'pass', warn: 'soft', bad: 'fail', info: 'accent' } as const;

	/** A line's name without its variation, e.g. "Breyer Defense" under "Ruy Lopez: Closed". */
	const shortLine = (line: IndexedLine) =>
		line.name === line.variation ? 'Main line' : line.name.slice(line.variation.length).replace(/^,\s*/, '');

	/** A variation's name without the opening's family, e.g. "Closed" in the Ruy Lopez. */
	const shortVariation = (name: string) => name.replace(/^[^:]+:\s*/, '') || name;

	const linesWord = (n: number) => `${n} line${n === 1 ? '' : 's'}`;

	/**
	 * The one card that says what is happening: whose move, what the last move
	 * earned, and what to do now. Everything else on the page is reference.
	 */
	const notice = $derived.by((): { tone: 'pass' | 'soft' | 'fail' | 'wait' | 'accent'; title: string; text: string } => {
		if (freeplay) {
			const title = {
				thinking: 'Computer is thinking…',
				'your-move': 'Your move — play on',
				retry: 'Try again',
				reveal: 'Play the highlighted move',
				over: 'Game over'
			}[freeplay.phase];
			return {
				tone: freeplay.phase === 'thinking' ? 'wait' : TONES[freeplay.message?.tone ?? 'info'],
				title,
				text: freeplay.message?.text ?? "You're past the memorised moves. Every move gets a verdict, and the computer sometimes errs on purpose — punish it."
			};
		}
		if (explore) {
			const message = explore.message;
			const tone = message ? TONES[message.tone] : 'accent';
			switch (explore.phase) {
				case 'thinking':
					return {
						tone: 'wait',
						title: explore.loadingEngine ? 'Loading the engine…' : yourTurn ? 'Evaluating…' : 'Computer is thinking…',
						text: message?.text ?? ''
					};
				case 'your-move': {
					if (explore.inOpening) {
						return { tone, title: `Play the ${bundle.name}`, text: message?.text ?? `It starts ${openingSan}. The lines after that are yours to discover.` };
					}
					const following = explore.following;
					if (following) {
						return {
							tone,
							title: 'Follow the line',
							text: message?.text ?? `You're in ${following.entryName ?? following.variation}. How does it continue?`
						};
					}
					if (explore.inBook) {
						return { tone, title: 'Your move', text: message?.text ?? 'Established lines continue from here. What would you play?' };
					}
					return {
						tone,
						title: 'Your move — past the known lines',
						text: message?.text ?? 'Every move gets a verdict. The computer sometimes errs on purpose — punish it.'
					};
				}
				case 'decide':
					return { tone: 'fail', title: 'Try again?', text: message?.text ?? '' };
				case 'over':
					return { tone, title: 'Game over', text: message?.text ?? '' };
			}
		}
		if (caughtUp) {
			return caughtUp.lines
				? { tone: 'pass', title: 'All caught up', text: `No line is due for review${memory?.nextDue ? ` — the next comes back ${dueIn(memory.nextDue)}` : ''}. Replay one anyway, or explore to find more.` }
				: { tone: 'accent', title: 'Nothing to practise yet', text: 'Practice replays the lines you have discovered. Explore first — every line you find comes back here to be remembered.' };
		}
		if (!review) return { tone: 'wait', title: 'Loading…', text: '' };
		const message = review.message;
		switch (review.phase) {
			case 'opponent':
				return { tone: 'wait', title: 'Opponent is moving…', text: message?.text ?? '' };
			case 'await':
				return { tone: message?.tone === 'pass' ? 'pass' : 'accent', title: 'Your move — from memory', text: message?.text ?? 'Replay a line you discovered. How does it continue?' };
			case 'retry':
				return { tone: message?.tone === 'soft' ? 'soft' : 'fail', title: 'One more try', text: message?.text ?? '' };
			case 'reveal':
				return { tone: 'accent', title: 'Play the highlighted move', text: message?.text ?? '' };
			case 'done': {
				const result = review.result!;
				return {
					tone: result.rating === 'again' ? 'soft' : 'pass',
					title: REVIEW_WORDS[result.rating],
					text: `${review.line.name}. It comes back ${dueIn(result.due)}.`
				};
			}
		}
	});

	// A completed line is celebrated until the learner's next move has been answered; between a line's
	// entrance and its end, the card anticipates it instead.
	const celebration = $derived.by<DiscoveryEvent | null>(() => {
		const latest = explore?.events.findLast((e) => e.kind === 'discovered');
		return latest && explore && explore.game.history.length - latest.ply <= 2 ? latest : null;
	});
	const anticipation = $derived(explore && !explore.inOpening && !celebration ? explore.progress : null);

	const pairs = $derived(movePairs(game?.history ?? []));

	const share = (value: number | null | undefined) => `${Math.round((value ?? 0) * 100)}%`;

	function onKey(event: KeyboardEvent) {
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if ((event.target as HTMLElement | null)?.closest('input, textarea, select')) return;
		if (event.key === 'n' && (explore || review?.phase === 'done' || caughtUp || freeplay)) void restart();
		else if (event.key === 'h' && explore?.phase === 'your-move') explore.hint();
		else if (event.key === 'h' && review && ['await', 'retry'].includes(review.phase)) review.hint();
		else if (event.key === 't' && explore?.phase === 'decide') explore.tryAgain();
		else if (event.key === 'w' && explore?.phase === 'decide') void explore.explain();
		else if (event.key === 'b' && explore?.canTakeBack) void explore.takeBack();
		else if (event.key === 'k' && review?.phase === 'done' && !freeplay) void keepPlaying();
		else if (event.key === 'e' && mode !== 'explore') void startExplore();
		else if (event.key === 'p' && mode !== 'practice') void startPractice();
	}
</script>

<svelte:head>
	<title>{bundle.name} — Lethal Chess</title>
</svelte:head>

<svelte:window onkeydown={onKey} />

<main>
	<div class="layout">
		<div class="board-column">
			<div class="board-slot">
			{#if freeplay}
				<Board
					fen={freeplay.game.fen}
					orientation={bundle.side}
					interactive={['your-move', 'retry', 'reveal'].includes(freeplay.phase)}
					legalTargets={freeplay.game.legalTargets}
					needsPromotion={freeplay.game.needsPromotion}
					marks={freeplay.marks}
					arrows={freeplay.arrows}
					onMove={(from, to, promotion) => void freeplay?.submit(from, to, promotion).catch(ignoreDestroyed)}
				/>
			{:else if explore}
				<Board
					fen={explore.game.fen}
					orientation={bundle.side}
					interactive={explore.phase === 'your-move'}
					legalTargets={explore.game.legalTargets}
					needsPromotion={explore.game.needsPromotion}
					marks={explore.marks}
					arrows={explore.arrows}
					onMove={(from, to, promotion) => void explore?.submit(from, to, promotion).catch(ignoreDestroyed)}
				/>
			{:else if review}
				<Board
					fen={review.game.fen}
					orientation={bundle.side}
					interactive={['await', 'retry', 'reveal'].includes(review.phase)}
					legalTargets={review.game.legalTargets}
					needsPromotion={review.game.needsPromotion}
					marks={review.marks}
					arrows={review.arrows}
					onMove={(from, to, promotion) => void review?.submit(from, to, promotion)}
				/>
			{:else}
				<Board fen={rootFen} orientation={bundle.side} interactive={false} onMove={() => {}} />
			{/if}
			</div>
		</div>

		<aside class="panel">
			<header class="track">
				<p class="side"><i class="stone" class:black={bundle.side === 'b'}></i>You play {bundle.side === 'w' ? 'White' : 'Black'}</p>
				<h1>{bundle.name}</h1>
				<p class="opening num">{openingSan}</p>
				{#if variationName && variationName !== bundle.name}
					<p class="variation">{variationName}</p>
				{/if}
			</header>

			<div class="modes">
				<div class="segmented" role="tablist" aria-label="Mode">
					<button type="button" role="tab" aria-selected={mode === 'explore'} onclick={() => startExplore()}>Explore</button>
					<button type="button" role="tab" aria-selected={mode === 'practice'} onclick={() => startPractice()}>Practice</button>
				</div>
				<p class="mode-hint">
					{#if mode === 'explore'}The lines are secret. Play good moves to discover them.{:else}Replay the lines you found, from memory. They come back when you're about to forget.{/if}
				</p>
			</div>

			{#if celebration}
				{#key celebration.id}
					<div class="discovery" data-kind={celebration.assisted ? 'assisted' : celebration.known ? 'known' : 'discovered'} role="status">
						<p class="kicker">
							{#if celebration.assisted}
								End of the line — with a hint
							{:else if celebration.known}
								Line completed again
							{:else}
								{celebration.lines.length > 1 ? `${celebration.lines.length} lines discovered` : 'Line discovered'}
							{/if}
							{#if celebration.lines.some((l) => l.dubious)}<span class="tag">dubious</span>{/if}
						</p>
						<p class="name">{celebration.lines[0].name}</p>
						{#if celebration.assisted}<p class="sub">Find it without the hint to count it.</p>{/if}
					</div>
				{/key}
			{:else if anticipation}
				{#key anticipation.name}
					<div class="discovery" data-kind="entered" role="status">
						<p class="kicker">{anticipation.allKnown ? 'Known line' : 'Line in progress'}</p>
						<p class="name">{anticipation.name}</p>
						<span class="pips" aria-hidden="true">
							{#each { length: Math.min(anticipation.total, 24) } as _, i (i)}
								<i class:on={i < anticipation.played}></i>
							{/each}
						</span>
						<p class="sub">
							{anticipation.allKnown
								? 'Already discovered — see it through again.'
								: anticipation.lines > 1
									? `${anticipation.lines} lines to find from here. Keep going.`
									: 'One line left here. See it through to the end.'}
						</p>
					</div>
				{/key}
			{:else if review && review.phase !== 'done'}
				<div class="discovery" data-kind="entered" role="status">
					<p class="kicker">Replaying a line</p>
					<p class="name">Name hidden until the end</p>
					<span class="pips" aria-hidden="true">
						{#each { length: Math.min(review.progress.total, 24) } as _, i (i)}
							<i class:on={i < review.progress.played}></i>
						{/each}
					</span>
				</div>
			{/if}

			<div class="notice" data-tone={notice.tone === 'accent' ? undefined : notice.tone} aria-live="polite">
				<p class="title">
					<i class="turn" class:black={!yourTurn ? bundle.side === 'w' : bundle.side === 'b'} aria-hidden="true"></i>
					{notice.title}
				</p>
				{#if notice.text}<p class="text">{notice.text}</p>{/if}
				{#if freeplay}
					<div class="actions">
						<button type="button" class="btn" onclick={() => startPractice()}>Back to practice</button>
					</div>
				{:else if explore}
					<div class="actions">
						{#if explore.phase === 'decide'}
							<button type="button" class="btn primary" onclick={() => explore?.tryAgain()}>Try again <kbd>T</kbd></button>
							<button type="button" class="btn" onclick={() => explore?.explain()} disabled={Boolean(explore.explanation)}>Why? <kbd>W</kbd></button>
							<button type="button" class="btn" onclick={() => explore?.playOn()}>Play on</button>
						{:else}
							{#if explore.phase === 'your-move' && !explore.inOpening}
								<button type="button" class="btn" onclick={() => explore?.hint()} disabled={explore.hintLevel >= 2}>
									{explore.hintLevel === 0 ? 'Hint' : 'Show the move'} <kbd>H</kbd>
								</button>
							{/if}
							{#if explore.canTakeBack}
								<button type="button" class="btn" onclick={() => explore?.takeBack()}>Take back <kbd>B</kbd></button>
							{/if}
						{/if}
						<button type="button" class="btn" class:primary={explore.phase === 'over'} onclick={() => startExplore()}>New game <kbd>N</kbd></button>
					</div>
					{#if explore.phase === 'decide' && explore.explanation}
						<p class="text why">
							{#if explore.explanation.kind === 'refutation'}
								The reply that punishes it: <b class="num">{explore.explanation.san}</b>.
							{:else}
								You could have played <b class="num">{explore.explanation.san}</b>.
							{/if}
							<span class="pv num">{explore.explanation.line.join(' ')}</span>
						</p>
					{/if}
					{#if explore.hintLevel === 2 && !explore.inOpening}
						<p class="text small">Lines through a shown move need another game to count.</p>
					{/if}
				{:else if caughtUp}
					<div class="actions">
						{#if caughtUp.lines}
							<button type="button" class="btn" onclick={() => startPractice(true)}>Replay a line anyway</button>
						{/if}
						<button type="button" class="btn primary" onclick={() => startExplore()}>Explore <kbd>E</kbd></button>
					</div>
				{:else if review}
					<div class="actions">
						{#if review.phase === 'done'}
							<button type="button" class="btn primary" onclick={() => startPractice()}>Next line <kbd>N</kbd></button>
							<button type="button" class="btn" onclick={keepPlaying} disabled={engineLoading}>
								{engineLoading ? 'Loading engine…' : 'Keep playing'} <kbd>K</kbd>
							</button>
						{:else if review.phase === 'await' || review.phase === 'retry'}
							<button type="button" class="btn" onclick={() => review?.hint()}>
								{review.hintLevel === 0 ? 'Hint' : 'Show the move'} <kbd>H</kbd>
							</button>
						{/if}
					</div>
					{#if engineError}
						<p class="text error">{engineError}</p>
					{/if}
				{/if}
			</div>

			{#if !freeplay && node && node.candidates.length}
				<div class="position">
					{#if node.sharpness !== undefined}
						<div class="stat">
							<p class="label">How exact you must be</p>
							<p class="value">{SHARPNESS_WORDS[sharpnessLevel(node.sharpness)]}</p>
							<Meter level={sharpnessLevel(node.sharpness)} label="How exact you must be" />
						</div>
					{/if}
				</div>
			{/if}

			<ol class="moves num" aria-label="Moves">
				{#each pairs as pair, i (pair.number)}
					<li>
						<span class="n">{pair.number}.</span>
						<span class="m" class:cur={i === pairs.length - 1 && !pair.black}>{pair.white}</span>
						<span class="m" class:cur={i === pairs.length - 1 && pair.black}>{pair.black}</span>
					</li>
				{/each}
			</ol>

			{#if mode === 'explore' && summary}
				<div class="prof discoveries">
					<p class="label">{bundle.name} — lines you've discovered</p>
					<div class="tally">
						<p class="count num"><strong>{summary.sound.discovered}</strong> <span>/ {summary.sound.total}</span></p>
						<p class="label small">
							{#if summary.sound.entered}{summary.sound.entered} more entered, not yet followed to the end.{:else}Reach a line's end to discover it.{/if}
						</p>
					</div>
					<span class="track split" aria-hidden="true">
						<span class="fill" style="width:{share(summary.sound.total ? summary.sound.discovered / summary.sound.total : 0)}"></span>
						<span class="fill entered" style="width:{share(summary.sound.total ? summary.sound.entered / summary.sound.total : 0)}"></span>
					</span>

					<details class="variations">
						<summary>By variation <span class="num">{summary.variations.length}</span></summary>
						<ul>
							{#each summary.variations as variation (variation.name)}
								<li>
									<p class="var-row">
										<span>{shortVariation(variation.name)}</span>
										<span class="num">{variation.discovered}/{variation.total}</span>
									</p>
									{#if variation.found.length}
										<ul class="found">
											{#each variation.found as { line, stage } (line.key)}
												<li data-stage={stage}>{stage === 'discovered' ? shortLine(line) : `${line.entryName ?? line.variation} …`}</li>
											{/each}
										</ul>
									{/if}
									{#if variation.total - variation.found.length > 0}
										<p class="secret">{variation.total - variation.found.length} still secret</p>
									{/if}
								</li>
							{/each}
						</ul>
					</details>

					{#if summary.dubious.total}
						<details class="variations">
							<summary>Dubious lines <span class="num">{summary.dubious.discovered}/{summary.dubious.total}</span></summary>
							<p class="label small">Established, but they take a move the engine calls a mistake. Worth knowing, not worth playing.</p>
							<ul class="found">
								{#each summary.dubious.found as { line, stage } (line.key)}
									<li data-stage={stage}>{stage === 'discovered' ? line.name : `${line.entryName ?? line.variation} …`}</li>
								{/each}
							</ul>
							{#if summary.dubious.total - summary.dubious.found.length > 0}
								<p class="secret">{summary.dubious.total - summary.dubious.found.length} still secret</p>
							{/if}
						</details>
					{/if}
					{@render saveStatus()}
				</div>
			{:else if mode === 'practice' && memory}
				<div class="prof">
					<p class="label">{bundle.name} — lines you remember</p>
					<div class="tally">
						<p class="count num"><strong>{memory.remembered}</strong> <span>/ {memory.discovered} discovered</span></p>
						<p class="label small">
							{#if memory.due}{memory.due} due now.{:else if memory.nextDue}Next review {dueIn(memory.nextDue)}.{:else}Discover lines in Explore to review them here.{/if}
						</p>
					</div>
					<span class="track split" aria-hidden="true">
						<span class="fill" style="width:{share(memory.discovered ? memory.mastered / memory.discovered : 0)}"></span>
						<span class="fill entered" style="width:{share(memory.discovered ? (memory.remembered - memory.mastered) / memory.discovered : 0)}"></span>
					</span>
					<p class="label small">
						{memory.mastered} mastered — remembered and stable for three weeks or more.
					</p>
					{@render saveStatus()}
				</div>
			{/if}
		</aside>
	</div>
</main>

{#snippet saveStatus()}
	<p class="label small save" data-status={sync.status ?? 'local'} role="status">
		{#if sync.status === 'synced'}
			Saved to your account.
		{:else if sync.status === 'pending'}
			Saving…
		{:else if sync.status === 'offline'}
			Can't reach the server — progress is kept on this device and will sync.
		{:else if sync.status === 'signed-out'}
			Your session has ended — progress is kept on this device. <a href="/auth/google">Sign in</a> to save it.
		{:else}
			Saved in this browser. <a href="/auth/google">Sign in</a> to keep it everywhere.
		{/if}
	</p>
{/snippet}

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

	.board-column {
		display: flex;
		justify-content: center;
		align-items: stretch;
		gap: 0.6rem;
		position: sticky;
		top: 1rem;
	}

	.board-slot {
		flex: 0 1 auto;
		width: min(78vh, 100%);
		min-width: 0;
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	.side {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin: 0;
		font-size: 0.85rem;
		color: var(--text-2);
	}

	.stone,
	.turn {
		flex: none;
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 50%;
		background: var(--pw1);
		box-shadow: 0 0 0 1.5px var(--pws) inset;
	}

	.stone.black,
	.turn.black {
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

	.variation {
		margin: 0.25rem 0 0;
		color: var(--text-2);
	}

	.modes {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 0.8rem;
	}

	.mode-hint {
		margin: 0;
		font-size: 0.85rem;
		color: var(--text-2);
	}

	.notice .title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		font-size: 1.05rem;
		font-weight: 600;
	}

	.notice .text {
		margin: 0.35rem 0 0;
		color: var(--text-2);
		line-height: 1.45;
	}

	.notice .text.error {
		color: var(--bad);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.8rem;
	}

	.position {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem 1.2rem;
		padding-top: 0.9rem;
		border-top: 1px solid var(--border);
	}

	.label {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-2);
	}

	.value {
		margin: 0.25rem 0 0.45rem;
		font-size: 1.3rem;
		font-weight: 500;
		line-height: 1;
	}



	.moves {
		display: grid;
		grid-template-columns: 2.4em 1fr 1fr;
		row-gap: 2px;
		margin: 0;
		padding: 0.6rem 0 0;
		list-style: none;
		border-top: 1px solid var(--border);
		font-size: 0.95rem;
	}

	.moves li {
		display: contents;
	}

	.moves .n {
		color: var(--text-3);
		padding: 2px 0;
	}

	.moves .m {
		padding: 2px 8px;
		border-radius: 4px;
	}

	.moves .m.cur {
		background: var(--surface-2);
		color: var(--text);
		font-weight: 600;
	}

	.prof {
		display: grid;
		gap: 0.7rem;
		padding-top: 0.9rem;
		border-top: 1px solid var(--border);
	}





	.small {
		font-size: 0.78rem;
		color: var(--text-3);
	}

	.opening {
		margin: 0.2rem 0 0;
		font-size: 0.85rem;
		color: var(--text-3);
	}

	/* Discoveries: a card above the notice, lit in the discovery's tone. */
	.discovery {
		position: relative;
		padding: 0.7rem 1rem 0.75rem 1.1rem;
		border: 1px solid color-mix(in srgb, var(--disc-tone) 45%, var(--border));
		border-radius: 10px;
		background: color-mix(in srgb, var(--disc-tone) 9%, var(--surface-1));
		box-shadow: 0 0 24px color-mix(in srgb, var(--disc-tone) 16%, transparent);
		animation: discovery-in 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both;
		--disc-tone: var(--accent);
	}

	.discovery[data-kind='discovered'] {
		--disc-tone: var(--ok);
	}

	.discovery[data-kind='assisted'],
	.discovery[data-kind='known'] {
		--disc-tone: var(--text-3);
	}

	.discovery[data-kind='discovered'] .name {
		animation: celebrate 0.9s ease-out;
	}

	@keyframes celebrate {
		0% {
			text-shadow: 0 0 0 transparent;
		}
		35% {
			text-shadow: 0 0 18px color-mix(in srgb, var(--ok) 70%, transparent);
		}
		100% {
			text-shadow: 0 0 0 transparent;
		}
	}

	.pips {
		display: flex;
		gap: 3px;
		margin-top: 0.45rem;
	}

	.pips i {
		flex: 1;
		max-width: 1.6rem;
		height: 4px;
		border-radius: 2px;
		background: color-mix(in srgb, var(--disc-tone) 22%, var(--surface-2));
		transition: background 0.3s ease;
	}

	.pips i.on {
		background: var(--disc-tone);
	}

	.discovery p {
		margin: 0;
	}

	.discovery .kicker {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--disc-tone);
	}

	.discovery .tag {
		padding: 0 0.4em;
		border: 1px solid var(--soft);
		border-radius: 4px;
		color: var(--soft);
		letter-spacing: 0.06em;
	}

	.discovery .name {
		margin-top: 0.2rem;
		font-family: var(--font-display);
		font-size: 1.3rem;
		line-height: 1.15;
		color: var(--text);
	}

	.discovery .sub {
		margin-top: 0.15rem;
		font-size: 0.8rem;
		color: var(--text-2);
	}

	@keyframes discovery-in {
		from {
			opacity: 0;
			transform: translateY(-0.4rem);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.discovery {
			animation: none;
		}
	}

	.notice .text.why .pv {
		display: block;
		margin-top: 0.2rem;
		font-size: 0.85rem;
		color: var(--text-3);
	}

	.notice .text.small {
		font-size: 0.8rem;
		color: var(--text-3);
	}

	.tally {
		display: flex;
		align-items: baseline;
		gap: 0.8rem;
	}

	.count {
		margin: 0;
		white-space: nowrap;
	}

	.count strong {
		font-size: 1.8rem;
		font-weight: 500;
	}

	.count span {
		color: var(--text-2);
	}

	.track.split {
		display: flex;
		height: 5px;
		border-radius: 3px;
		background: var(--surface-2);
		box-shadow: 0 0 0 1px var(--border) inset;
		overflow: hidden;
	}

	.track.split .fill {
		display: block;
		height: 100%;
		background: var(--accent);
		transition: width 0.5s ease;
	}

	.track.split .fill.entered {
		background: color-mix(in srgb, var(--accent) 35%, transparent);
	}

	.variations summary {
		display: flex;
		justify-content: space-between;
		cursor: pointer;
		font-size: 0.9rem;
		color: var(--text-2);
	}

	.variations summary .num {
		color: var(--text-3);
	}

	.variations ul {
		margin: 0.5rem 0 0;
		padding: 0;
		list-style: none;
	}

	.variations > ul > li {
		padding: 0.35rem 0;
		border-top: 1px solid var(--border);
	}

	.var-row {
		display: flex;
		justify-content: space-between;
		margin: 0;
		font-size: 0.9rem;
	}

	.var-row .num {
		color: var(--text-2);
	}

	.found {
		display: grid;
		gap: 0.15rem;
		margin-top: 0.25rem !important;
		font-size: 0.82rem;
	}

	.found li {
		padding-left: 1rem;
		position: relative;
		color: var(--text);
	}

	.found li::before {
		content: '✓';
		position: absolute;
		left: 0;
		color: var(--ok);
	}

	.found li[data-stage='entered'] {
		color: var(--text-2);
	}

	.found li[data-stage='entered']::before {
		content: '›';
		color: var(--accent);
	}

	.secret {
		margin: 0.2rem 0 0;
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

		.board-column {
			position: static;
			flex-direction: column;
			gap: 0.5rem;
		}

		.board-slot {
			width: 100%;
		}

		/* On a phone the verdict sits right under the board, before anything else. */
		.panel {
			display: grid;
			grid-template-columns: 1fr;
			gap: 0.9rem;
		}

		.discovery {
			order: -3;
		}

		.notice {
			order: -2;
		}

		.modes {
			order: -1;
		}

		.track h1 {
			font-size: 1.5rem;
		}

		.moves {
			max-height: 11rem;
			overflow-y: auto;
		}
	}
</style>
