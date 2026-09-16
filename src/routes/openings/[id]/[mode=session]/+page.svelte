<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { SessionMode } from '../../../../params/session';
	import Board from '$lib/components/Board.svelte';
	import { Engine, ignoreDestroyed } from '$lib/chess/engine';
	import { Game, parseUci } from '$lib/chess/game.svelte';
	import { FreePlay } from '$lib/coach/freeplay.svelte';
	import { progressStore, sync } from '$lib/drill/account.svelte';
	import type { ProgressStore } from '$lib/drill/progress';
	import { toEpd } from '$lib/drill/tree';
	import { Book, stagesOf, summarize, type DiscoverySummary, type IndexedLine, type LineStage } from '$lib/explore/book';
	import { lineCards, mastery, nextLine, reviewable, type Mastery } from '$lib/explore/mastery';
	import { ReviewSession } from '$lib/explore/review.svelte';
	import { ExploreSession, type DiscoveryEvent, type ExploreOptions, type RoundMove } from '$lib/explore/session.svelte';
	import LineMap from '$lib/ui/LineMap.svelte';
	import LineShelf from '$lib/ui/LineShelf.svelte';
	import MoveTree from '$lib/ui/MoveTree.svelte';
	import Copy from '$lib/ui/Copy.svelte';
	import Meter from '$lib/ui/Meter.svelte';
	import EvalBar from '$lib/ui/EvalBar.svelte';
	import { movePairs, SHARPNESS_WORDS, sharpnessLevel } from '$lib/ui/position';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const bundle = $derived(data.bundle);
	const book = $derived(new Book(bundle));

	// The mode is the URL: /openings/[id]/explore or /practice. Switching is a param change on this same
	// screen, so the bundle and the engine stay; it replaces the history entry, so Back returns to the
	// dashboard rather than walking through every switch.
	const mode = $derived(page.params.mode as SessionMode);
	function switchTo(next: SessionMode) {
		if (next === mode) return void restart();
		void goto(`/openings/${bundle.id}/${next}`, { replaceState: true, noScroll: true });
	}

	// The start position, rendered on the server and until a session starts, so the board never flashes empty.
	const rootFen = new Game().fen;

	const openingSan = $derived.by(() => {
		const preview = new Game();
		preview.load(bundle.openingMoves ?? bundle.rootMoves);
		return preview.history.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}.${san}` : san)).join(' ');
	});

	let explore = $state<ExploreSession | null>(null);
	let review = $state<ReviewSession | null>(null);
	/** Practice found nothing due: how many lines could be replayed anyway. */
	let caughtUp = $state<{ lines: number } | null>(null);
	let memory = $state<Mastery | null>(null);
	let summary = $state<DiscoverySummary | null>(null);
	/** The learner's progress per line, refreshed on every discovery; the map reads it live. */
	let stages = $state<Map<string, LineStage>>(new Map());
	/** The line map, open at a band (or at the top). */
	let map = $state<{ band: string | null } | null>(null);
	let sheet = $state(false);
	let store: ProgressStore | null = null;

	const activeStore = () => (store ??= progressStore(data.user?.id ?? null));

	async function refreshStats() {
		const s = activeStore();
		const [discoveries, reviews] = await Promise.all([s.loadDiscoveries(bundle.id), s.loadReviews(bundle.id)]);
		stages = stagesOf(discoveries);
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

	/** Whatever is running stops before anything new starts, so an old session can't move or record. */
	function stopSessions() {
		explore?.abandon();
		review?.abandon();
	}

	async function startExplore(options: Pick<ExploreOptions, 'opponent' | 'roundMoves'> = {}) {
		stopSessions();
		freeplay = null;
		review = null;
		caughtUp = null;
		const s = activeStore();
		const discoveries = await s.loadDiscoveries(bundle.id);
		const next = new ExploreSession({
			bundle,
			book,
			stages: stagesOf(discoveries),
			engine: loadEngine,
			onDiscovery: (discovery) => void s.recordDiscovery(discovery).then(refreshStats),
			...options
		});
		explore = next;
		await next.start();
	}

	// A round of The Open is eight of the learner's moves: long enough to leave the book behind against
	// an opponent who may leave it at once, short enough to want another.
	const ROUND_MOVES = 8;
	const startOpen = () => startExplore({ opponent: 'human', roundMoves: ROUND_MOVES });

	/**
	 * Practice replays discovered lines from memory: the most overdue first, then lines never replayed.
	 * When nothing is due it says so; `anyway` replays a random discovered line regardless.
	 */
	async function startPractice(anyway = false) {
		stopSessions();
		freeplay = null;
		explore = null;
		review = null;
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

	const restart = () => (mode === 'explore' ? startExplore() : mode === 'open' ? startOpen() : startPractice());

	// On a phone the reference blocks move into a sheet, so the page itself never has to scroll.
	let narrow = $state(false);
	onMount(() => {
		const phone = matchMedia('(max-width: 860px)');
		const sync = () => (narrow = phone.matches);
		sync();
		phone.addEventListener('change', sync);
		onDestroy(() => phone.removeEventListener('change', sync));
		void refreshStats();
		return () => {
			stopSessions();
			engine?.destroy();
		};
	});

	// A session starts for the mode in the URL, and again whenever the URL's mode changes. The dashboard's
	// map sends a line along as ?line=<key>&ply=<n>: Explore picks it up and stops at ply n, which is the
	// line's end if it was found and its entrance if it was only entered.
	$effect(() => {
		const next = mode;
		const key = page.url.searchParams.get('line');
		const ply = Number(page.url.searchParams.get('ply'));
		untrack(() => void begin(next, key, Number.isFinite(ply) && ply > 0 ? ply : undefined));
	});

	async function begin(next: SessionMode, lineKey: string | null, ply?: number) {
		if (next === 'practice') return startPractice();
		if (next === 'open') return startOpen();
		await startExplore();
		const line = lineKey ? book.lines.find((l) => l.key === lineKey) : undefined;
		if (line && explore) await explore.resume(line, ply);
	}

	const game = $derived(freeplay?.game ?? explore?.game ?? review?.game ?? null);
	const node = $derived(game ? bundle.nodes[toEpd(game.fen)] : undefined);
	const yourTurn = $derived(game ? game.turn === bundle.side : false);
	// A replayed line keeps its name hidden until it is done: recalling it is the exercise. A round keeps it
	// hidden too — the name only moves when the opponent plays theory, which would say so.
	const variationName = $derived(
		explore ? (explore.round && explore.phase !== 'over' ? null : explore.name) : review?.phase === 'done' ? review.line.name : null
	);

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

	/** "4.Nc3" or "4…Nf6". */
	const moveLabel = (m: RoundMove) => `${Math.floor(m.ply / 2) + 1}${m.ply % 2 ? '…' : '.'}${m.san}`;

	/** The round's tally so far: how many decisions, and how many met the standard. */
	const tally = $derived.by(() => {
		const round = explore?.round;
		if (!round) return null;
		return { ...round, played: round.moves.length, precise: round.moves.filter((m) => m.precise).length };
	});

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
						title: explore.loadingEngine ? 'Loading the engine…' : yourTurn ? 'Evaluating…' : explore.round ? 'Opponent is thinking…' : 'Computer is thinking…',
						text: message?.text ?? ''
					};
				case 'your-move': {
					if (explore.inOpening) {
						return { tone, title: `Play the ${bundle.name}`, text: message?.text ?? `It starts ${openingSan}. The lines after that are yours to discover.` };
					}
					// The title is about now, the text about the last move; where the game stands is the line card's job.
					const prompt = explore.round
						? 'Whatever they play, find the best answer.'
						: explore.following
							? 'How does the line continue?'
							: explore.inBook
								? 'Established lines continue from here. What would you play?'
								: 'Every move gets a verdict. The computer sometimes errs on purpose — punish it.';
					return { tone, title: 'Your move', text: message?.text ?? prompt };
				}
				case 'browse':
					return {
						tone: 'wait',
						title: explore.atTip ? 'Latest position' : 'Looking back',
						text: explore.atTip
							? 'Play on, or step back through the game.'
							: 'Step through the game with ← and →, or play on from this position.'
					};
				case 'over':
					return {
						tone,
						title: tally ? `Round over — ${tally.precise} of ${tally.played} precise` : 'Game over',
						text: message?.text ?? ''
					};
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
		if (!latest || !explore) return null;
		// A take back can put the game before the discovery: then there is nothing to celebrate.
		const since = explore.game.history.length - latest.ply;
		return since >= 0 && since <= 2 ? latest : null;
	});
	// In a round the line card would say the opponent just played theory, which is the thing to work out.
	const anticipation = $derived(explore && !explore.inOpening && !explore.round && !celebration ? explore.progress : null);

	/** Destination squares of the moves played since the entrance of the line in progress. */
	const trail = $derived.by(() => {
		if (!explore || !anticipation?.played) return [];
		return explore.game.uciHistory.slice(-anticipation.played).map((uci) => parseUci(uci).to);
	});

	/**
	 * What the board traces. A discovery draws the line's route from its entrance; otherwise, a position
	 * picked off the chart draws the way it was reached. A discovery wins, since it is tied to the move
	 * just played.
	 */
	const boardCelebration = $derived.by(() => {
		if (celebration && !celebration.assisted && explore?.game.history.length === celebration.ply) {
			const line = celebration.lines[0];
			const route = line.moves.slice(Math.min(line.entry, line.moves.length - 1));
			return { id: celebration.id, path: route.map((uci) => parseUci(uci)) };
		}
		const replay = explore?.replay;
		// Negative, so a replay's id can never collide with a discovery's and hold back its animation.
		return replay ? { id: -replay.id, path: replay.path.map((uci) => parseUci(uci)) } : null;
	});

	// A mote flies from the line's last square into the counter under the board.
	let counter = $state<HTMLElement | null>(null);
	let boardColumn = $state<HTMLElement | null>(null);
	let flown = 0;
	$effect(() => {
		const moment = boardCelebration;
		if (!moment || moment.id === flown || celebration?.known || !counter || !boardColumn) return;
		flown = moment.id;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const square = boardColumn.querySelector(`[data-square="${moment.path.at(-1)!.to}"]`)?.getBoundingClientRect();
		const target = counter.getBoundingClientRect();
		if (!square) return;
		const mote = document.createElement('span');
		mote.className = 'mote';
		const x = square.left + square.width / 2;
		const y = square.top + square.height / 2;
		Object.assign(mote.style, { left: `${x}px`, top: `${y}px` });
		document.body.appendChild(mote);
		const dx = target.left + 12 - x;
		const dy = target.top + target.height / 2 - y;
		mote
			.animate(
				[
					{ transform: 'translate(0, 0) scale(1)', opacity: 0, offset: 0 },
					{ transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0.35 },
					{ transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(1.3)`, opacity: 1, offset: 0.75 },
					{ transform: `translate(${dx}px, ${dy}px) scale(0.6)`, opacity: 1, offset: 1 }
				],
				{ duration: 1150, easing: 'cubic-bezier(.4, 0, .6, 1)', fill: 'forwards' }
			)
			.finished.finally(() => mote.remove());
	});

	const pairs = $derived(movePairs(game?.history ?? []));
	/** The game so far, in the notation an analysis board will take. */
	const movesText = $derived(pairs.map((p) => `${p.number}.${p.white}${p.black ? ` ${p.black}` : ''}`).join(' '));

	/**
	 * Past the established lines the page becomes an analysis board: the evaluation is shown, and the game
	 * can be walked back and forward. Inside the book it stays hidden — it would give the lines away. A
	 * round of The Open hides it until the round is over: a bar that jumps says the opponent just erred.
	 */
	const analysing = $derived(
		Boolean(freeplay) || Boolean(explore && !explore.inOpening && !explore.inBook && (!explore.round || explore.phase === 'over'))
	);
	const evaluation = $derived(freeplay ? freeplay.evaluation : (explore?.evaluation ?? null));
	/** Moves the learner can click back to: the game plus anything taken off while browsing. */
	const browsedPly = $derived(explore ? explore.game.uciHistory.length : (game?.uciHistory.length ?? 0));

	/** Where the game is on the map: the line being followed, else any line through the position. */
	const here = $derived.by(() => {
		if (!explore || explore.inOpening) return null;
		const at = book.at(toEpd(explore.game.fen));
		return at.find((p) => p.line === explore?.following) ?? at[0] ?? null;
	});


	const share = (value: number | null | undefined) => `${Math.round((value ?? 0) * 100)}%`;

	function onKey(event: KeyboardEvent) {
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if ((event.target as HTMLElement | null)?.closest('input, textarea, select')) return;
		if (event.key === 'n' && (explore || review?.phase === 'done' || caughtUp || freeplay)) void restart();
		else if (event.key === 'h' && explore?.phase === 'your-move') explore.hint();
		else if (event.key === 'h' && review && ['await', 'retry'].includes(review.phase)) review.hint();
		else if (event.key === 'w' && explore?.canExplain) void explore.explain();
		else if (event.key === 'b' && explore?.canTakeBack) void explore.takeBack();
		else if (event.key === 'ArrowLeft' && explore) explore.back();
		else if (event.key === 'ArrowRight' && explore) void explore.forward();
		else if (event.key === 'Enter' && explore?.phase === 'browse') void explore.playFromHere();
		else if (event.key === 'k' && review?.phase === 'done' && !freeplay) void keepPlaying();
		else if (event.key === 'e' && mode !== 'explore') switchTo('explore');
		else if (event.key === 'p' && mode !== 'practice') switchTo('practice');
		else if (event.key === 'o' && mode !== 'open') switchTo('open');
		else if (event.key === 'm' && mode === 'explore' && summary) map = map ? null : { band: null };
	}
</script>

<svelte:head>
	<title>{bundle.name} · {mode === 'practice' ? 'Practice' : mode === 'open' ? 'The Open' : 'Explore'} — Lethal Chess</title>
</svelte:head>

<svelte:window onkeydown={onKey} />

<main>
	<div class="layout">
		<div class="board-column" bind:this={boardColumn}>
			{#if analysing}
				<div class="eval"><EvalBar score={evaluation} side={bundle.side} stale={!evaluation} /></div>
			{/if}
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
					interactive={explore.canMove}
					legalTargets={explore.game.legalTargets}
					needsPromotion={explore.game.needsPromotion}
					marks={explore.marks}
					arrows={explore.arrows}
					{trail}
					celebration={boardCelebration}
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
			{#if explore && (analysing || explore.phase === 'browse')}
				<div class="browse">
					<button type="button" class="btn small" onclick={() => explore?.back()} disabled={!explore.canBack} aria-label="One move back">◀</button>
					<button type="button" class="btn small" onclick={() => explore?.forward()} disabled={!explore.canForward} aria-label="One move forward">▶</button>
					<span class="browse-note">{explore.atTip ? 'Latest position' : 'Looking back — move a piece to carry on from here'}</span>
				</div>
			{/if}
			{#if mode === 'explore' && summary && !freeplay}
				<LineShelf variations={summary.variations} here={explore?.following?.variation ?? null} bind:count={counter} onopen={(band) => (map = { band })} />
			{/if}
			</div>
		</div>

		<aside class="panel">
			<header class="track" class:hidden={narrow}>
				{#if !narrow}
					<p class="side">
						<i class="stone" class:black={bundle.side === 'b'}></i>You play {bundle.side === 'w' ? 'White' : 'Black'}
						<a class="back" href="/openings/{bundle.id}">← Dashboard</a>
					</p>
				{/if}
				<h1 class="pick-text">{bundle.name}</h1>
				{#if !narrow}
					<p class="opening num pick-text">{openingSan}</p>
					{#if variationName && variationName !== bundle.name}
						<p class="variation">{variationName}</p>
					{/if}
				{/if}
			</header>

			<div class="modes">
				<div class="segmented" role="tablist" aria-label="Mode">
					<button type="button" role="tab" aria-selected={mode === 'explore'} onclick={() => switchTo('explore')}>Explore</button>
					<button type="button" role="tab" aria-selected={mode === 'practice'} onclick={() => switchTo('practice')}>Practice</button>
					<button type="button" role="tab" aria-selected={mode === 'open'} onclick={() => switchTo('open')}>The Open</button>
				</div>
				<p class="mode-hint">
					{#if mode === 'explore'}The lines are secret. Play good moves to discover them.{:else if mode === 'open'}They might play anything. Answer each move precisely — the best, or as good as.{:else}Replay the lines you found, from memory. They come back when you're about to forget.{/if}
				</p>
				{#if narrow}
					<button type="button" class="btn small sheet-button" onclick={() => (sheet = true)}>Moves &amp; progress</button>
				{/if}
			</div>

			<!-- A finished round's card would repeat the notice, which carries the score and the pips itself. -->
			<div class="line-slot" class:empty={(!explore && !review) || (tally && explore?.phase === 'over')}>
			{#if celebration}
				{#key celebration.id}
					<div class="discovery" data-kind={celebration.assisted ? 'assisted' : celebration.known ? 'known' : 'discovered'} role="status">
						<p class="kicker">
							{#if celebration.assisted}
								End of the line — with a hint
							{:else if celebration.known}
								Line completed again
							{:else}
								{celebration.lines.length > 1 ? `${celebration.lines.length} lines at once` : 'Line discovered'}
							{/if}
							{#if celebration.lines.some((l) => l.dubious)}<span class="tag">dubious</span>{/if}
						</p>
						<p class="name pick-text">{celebration.lines[0].name}</p>
						{#if celebration.assisted}
							<p class="sub">Find it without the hint to count it.</p>
						{:else if celebration.lines.length === 2}
							<!-- Two named lines can end on the same position by different move orders. Say so, or the
							     second one lights up on the map later with no memory of having found it. -->
							<p class="sub">Also <b>{shortLine(celebration.lines[1])}</b> — the same position, another move order.</p>
						{:else if celebration.lines.length > 2}
							<p class="sub">{celebration.lines.length - 1} more lines transpose to this position.</p>
						{/if}
					</div>
				{/key}
			{:else if explore && tally && explore.phase !== 'over'}
				<!-- The round: where it stands, one pip per decision. Nothing about the position, which is the exercise. -->
				<div class="discovery" data-kind="round" role="status">
					<p class="kicker">The Open · move {Math.min(tally.played + 1, tally.length)} of {tally.length}</p>
					<p class="name pick-text">{bundle.name}</p>
					{@render roundPips()}
					<p class="sub">
						{#if tally.played}{tally.precise} of {tally.played} precise so far.{:else}{tally.length} moves. Each is held to the best.{/if}
					</p>
				</div>
			{:else if anticipation}
				{#key anticipation.name}
					<div class="discovery" data-kind="entered" role="status">
						<p class="kicker">{anticipation.allKnown ? 'Known line' : 'Line in progress'}</p>
						<p class="name pick-text">{anticipation.name}</p>
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
					<p class="name pick-text">Name hidden until the end</p>
					<span class="pips" aria-hidden="true">
						{#each { length: Math.min(review.progress.total, 24) } as _, i (i)}
							<i class:on={i < review.progress.played}></i>
						{/each}
					</span>
				</div>
			{:else if explore && !explore.inOpening && !explore.round}
				<div class="discovery" data-kind="idle" role="status">
					<p class="kicker">{explore.inBook ? 'In the book' : 'Past the known lines'}</p>
					<p class="name pick-text">{explore.inBook ? (explore.name ?? bundle.name) : 'Free play'}</p>
					<p class="sub">{explore.inBook ? 'Established lines continue from here.' : 'The book ends here. Play on, or start a new game.'}</p>
				</div>
			{:else if explore && !explore.round}
				<div class="discovery" data-kind="idle" role="status">
					<p class="kicker">The opening</p>
					<p class="name pick-text">{bundle.name}</p>
					<p class="sub num">{openingSan}</p>
				</div>
			{/if}
			</div>

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
					{#if tally && explore.phase === 'over'}
						{@render roundPips()}
						{#if tally.precise < tally.played}
							<!-- The round is over, so nothing is secret: each miss with the move that beat it. -->
							<ul class="review num" aria-label="Moves that fell short">
								{#each tally.moves.filter((m) => !m.precise) as m (m.ply)}
									<li><b>{moveLabel(m)}</b> {m.better ? `→ ${m.better}` : '· hint'}</li>
								{/each}
							</ul>
						{/if}
					{/if}
					<div class="actions">
						{#if explore.phase === 'your-move' && !explore.inOpening}
							<button type="button" class="btn" onclick={() => explore?.hint()} disabled={explore.hintLevel >= 2}>
								{explore.hintLevel === 0 ? 'Hint' : 'Show the move'} <kbd>H</kbd>
							</button>
						{/if}
						{#if explore.canExplain}
							<button type="button" class="btn" onclick={() => explore?.explain()}>Why? <kbd>W</kbd></button>
						{/if}
						{#if explore.canTakeBack}
							<button type="button" class="btn" onclick={() => explore?.takeBack()}>Take back <kbd>B</kbd></button>
						{/if}
						<button type="button" class="btn" class:primary={explore.phase === 'over'} onclick={() => restart()}>{explore.round ? 'New round' : 'New game'} <kbd>N</kbd></button>
					</div>
					{#if explore.explanation}
						<p class="text why">
							What it allowed: <b class="num">{explore.explanation.san}</b>.
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
						<button type="button" class="btn primary" onclick={() => switchTo('explore')}>Explore <kbd>E</kbd></button>
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

			{#if !narrow}
				{@render referenceBlocks()}
			{/if}
		</aside>
	</div>
</main>

<!-- Phone only: everything the game does not need in front of you, one tap away. -->
{#if sheet}
	<button type="button" class="map-scrim" aria-label="Close" onclick={() => (sheet = false)}></button>
	<div class="map-sheet reference" role="dialog" aria-modal="true" aria-label="Moves and progress">
		<header class="sheet-head">
			<p class="side"><i class="stone" class:black={bundle.side === 'b'}></i>You play {bundle.side === 'w' ? 'White' : 'Black'} · <span class="num">{openingSan}</span></p>
			<!-- The phone's way back: the mode row has no room for another button, and an installed app has no Back. -->
			<a class="btn small" href="/openings/{bundle.id}">← Dashboard</a>
			<button type="button" class="btn small" onclick={() => (sheet = false)}>Close</button>
		</header>
		{@render referenceBlocks()}
	</div>
{/if}

<!-- The line map: a wide overlay on desktop, a bottom sheet on phones. Built only while open. -->
{#if map}
	<button type="button" class="map-scrim" aria-label="Close the map" onclick={() => (map = null)}></button>
	<div class="map-sheet" role="dialog" aria-modal="true" aria-label="Line map">
		<LineMap
			side={bundle.side}
			lines={book.lines}
			{stages}
			{here}
			opening={openingLength}
			title="{bundle.name} — the lines"
			band={map.band}
			onclose={() => (map = null)}
			onplay={(line, resumeTo) => {
				map = null;
				void explore?.resume(line, resumeTo);
			}}
		/>
	</div>
{/if}


{#snippet referenceBlocks()}
			<!-- How exact a position is would say a trap was just set: a round keeps it to itself. -->
			{#if !freeplay && mode !== 'open' && node && node.candidates.length}
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

	{#if explore}
		<MoveTree root={explore.root} current={explore.current} revision={explore.revision} onselect={(node) => explore?.goTo(node)} />
	{:else}
	<ol class="moves num pick-text" aria-label="Moves">
		{#each pairs as pair, i (pair.number)}
			<li>
				<span class="n">{pair.number}.</span>
				{#each [pair.white, pair.black] as san, half (half)}
					<span class="m" class:cur={i * 2 + half + 1 === browsedPly}>{san}</span>
				{/each}
			</li>
		{/each}
	</ol>
	{/if}

	<!-- A position and a game are worth taking elsewhere, and neither is worth selecting by hand. -->
	{#if game && movesText}
		<p class="copies">
			<Copy value={game.fen} label="Copy position" />
			<Copy value={movesText} label="Copy moves" />
		</p>
	{/if}


	{#if mode === 'explore' && summary}
		<div class="prof discoveries">
			<p class="label">
				{bundle.name} — {summary.sound.discovered} of {summary.sound.total} lines discovered{#if summary.sound.entered}, {summary.sound.entered} more entered{/if}.
			</p>

			<button type="button" class="btn map-button" onclick={() => (map = { band: null })}>
				Open the map <kbd>M</kbd>
			</button>

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
										<li data-stage={stage}>{stage === 'discovered' ? shortLine(line) : `${shortVariation(line.entryName ?? line.variation)} …`}</li>
									{/each}
								</ul>
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
							<li data-stage={stage}>{stage === 'discovered' ? shortVariation(line.name) : `${shortVariation(line.entryName ?? line.variation)} …`}</li>
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
	{:else if mode === 'open'}
		<div class="prof">
			<p class="label">{bundle.name} — The Open</p>
			<p class="label small">One round is {ROUND_MOVES} of your moves from the defining position. The first move you play at each turn is the one that counts; Hint gives the move away and the move stops counting.</p>
			{@render saveStatus()}
		</div>
	{/if}
{/snippet}

{#snippet roundPips()}
	{#if tally}
		<span class="pips round-pips" aria-hidden="true">
			{#each tally.moves as m (m.ply)}
				<i class:on={m.precise} class:miss={!m.precise}></i>
			{/each}
			{#each { length: Math.max(0, tally.length - tally.played) } as _, i (i)}
				<i></i>
			{/each}
		</span>
	{/if}
{/snippet}

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
		/* This screen hangs the navigation buttons and the variation shelf under the board, so its board
		   gets less of the window than one that stands alone. */
		--chrome: 12.5rem;
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
		gap: 2rem;
		align-items: start;
	}

	.board-column {
		display: flex;
		justify-content: center;
		align-items: stretch;
		gap: 0.6rem;
		position: sticky;
		/* Installed on iPhone the status bar is translucent: keep the board clear of it. */
		top: calc(1rem + env(safe-area-inset-top));
	}

	.board-slot {
		flex: 0 1 auto;
		width: min(calc(100dvh - var(--chrome)), 100%);
		min-width: 0;
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
		/* Never the reason the window scrolls: past the board's height the panel scrolls inside itself. */
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



	.eval {
		display: flex;
		flex: none;
	}

	/* Under the board, where the hands are: on a phone the panel is a scroll away. */
	.browse {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.6rem;
	}

	.browse .btn {
		min-width: 3rem;
		justify-content: center;
	}

	.browse-note {
		margin-left: auto;
		font-size: 0.78rem;
		color: var(--text-3);
	}

	.copies {
		display: flex;
		gap: 0.4rem;
		margin: 0.5rem 0 0;
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
		border: 0;
		border-radius: 4px;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
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
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--disc-tone);
	}

	/* The card's place is kept whatever it shows, so a discovery never pushes the buttons below it. */
	.line-slot {
		display: grid;
		min-height: 6.4rem;
	}

	.line-slot.empty {
		display: none;
	}

	.discovery[data-kind='idle'],
	.discovery[data-kind='round'] {
		--disc-tone: var(--text-2);
		border-color: var(--border);
		background: var(--surface-1);
		box-shadow: none;
		animation: none;
	}

	/* The round's pips are its score: lit for a precise move, warm for one that fell short. */
	.round-pips i {
		--disc-tone: var(--text-2);
	}

	.round-pips i.on {
		background: var(--ok);
	}

	.round-pips i.miss {
		background: var(--soft);
	}

	.notice .round-pips {
		margin-top: 0.6rem;
	}

	/* One chip per miss, wrapping: eight of them must still leave the phone room for the buttons. */
	.review {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem 1rem;
		margin: 0.5rem 0 0;
		padding: 0;
		list-style: none;
		font-size: 0.9rem;
		color: var(--text-2);
	}

	.review b {
		color: var(--text);
		font-weight: 600;
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

	.map-button {
		justify-self: start;
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
		inset: 2rem;
		z-index: 41;
		max-width: 1180px;
		margin: 0 auto;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface-1);
		box-shadow: 0 40px 80px -30px rgba(0, 0, 0, 0.6);
		overflow: hidden;
	}

	.sheet-button {
		margin-left: auto;
	}

	.back {
		margin-left: auto;
		font-size: 0.8rem;
		color: var(--text-3);
		text-decoration: none;
	}

	.back:hover,
	.back:focus-visible {
		color: var(--accent);
	}

	.track.hidden {
		display: none;
	}

	.map-sheet.reference {
		display: grid;
		align-content: start;
		gap: 0.5rem;
		padding: 0.9rem 1rem 2rem;
		overflow-y: auto;
	}

	/* The sheet is already a panel: the blocks inside it don't need their own rules and air. */
	.map-sheet.reference :global(.tree) {
		max-height: none;
	}

	.sheet-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.6rem;
		font-size: 0.85rem;
		color: var(--text-2);
	}

	.sheet-head .side {
		flex: 1 1 100%;
	}

	.sheet-head .btn:last-child {
		margin-left: auto;
	}

	@media (max-width: 860px) {
		main {
			padding: 0.6rem 0.75rem 0.5rem;
		}

		/* The mode names say it; the sentence under them is a line the phone cannot spare. */
		.mode-hint {
			display: none;
		}

		.notice {
			padding: 0.7rem 0.85rem;
		}

		.actions {
			margin-top: 0.6rem;
		}

		/* Thumb-sized, and the sentence goes: the buttons say what they do. */
		.browse .btn {
			flex: 1;
			min-height: 2.75rem;
		}

		.browse-note {
			display: none;
		}

		.layout {
			grid-template-columns: 1fr;
			gap: 0.65rem;
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
			gap: 0.65rem;
		}

		.line-slot {
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

		/* On a phone the map is a bottom sheet, in Overview. */
		.map-sheet {
			inset: auto 0 0 0;
			height: 82dvh;
			border-radius: 14px 14px 0 0;
			border-bottom: 0;
		}
	}
</style>
