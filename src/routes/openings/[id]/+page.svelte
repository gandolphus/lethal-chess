<script lang="ts">
	import { onMount } from 'svelte';
	import Board from '$lib/components/Board.svelte';
	import { Engine } from '$lib/chess/engine';
	import { Game } from '$lib/chess/game.svelte';
	import { FreePlay } from '$lib/coach/freeplay.svelte';
	import type { Grade } from '$lib/drill/grade';
	import { progressStore, sync } from '$lib/drill/account.svelte';
	import { proficiency, type Proficiency, type ProgressStore } from '$lib/drill/progress';
	import { DrillSession, type Mode } from '$lib/drill/session.svelte';
	import EvalBar from '$lib/ui/EvalBar.svelte';
	import Meter from '$lib/ui/Meter.svelte';
	import { evalWords, formatScore, movePairs, SHARPNESS_WORDS, sharpnessLevel, type Score } from '$lib/ui/position';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const bundle = $derived(data.bundle);

	// The root position, rendered on the server and until the session starts, so the board never flashes empty.
	const rootFen = $derived.by(() => {
		const preview = new Game();
		preview.load(bundle.openingMoves ?? bundle.rootMoves);
		return preview.fen;
	});

	let mode = $state<Mode>('learn');
	let session = $state<DrillSession | null>(null);
	let stats = $state<Proficiency | null>(null);
	let store: ProgressStore | null = null;

	async function refreshStats() {
		if (!store) return;
		const [cards, attempts] = await Promise.all([store.loadCards(bundle.id), store.loadAttempts(bundle.id)]);
		stats = proficiency(bundle, cards, attempts, new Date());
	}

	// Coached free play after a learn-mode line ends. The engine (a 7 MB download) loads only when first needed.
	let freeplay = $state<FreePlay | null>(null);
	let engine: Engine | null = null;
	let engineError = $state<string | null>(null);
	let engineLoading = $state(false);

	async function keepPlaying() {
		if (!session || engineLoading) return;
		engineLoading = true;
		try {
			engine ??= new Engine();
			await engine.ready;
		} catch (error) {
			engineError = (error as Error).message;
			engine = null;
			engineLoading = false;
			return;
		}
		engineLoading = false;
		const next = new FreePlay({ engine, startMoves: session.game.uciHistory, side: bundle.side });
		freeplay = next;
		await next.start();
	}

	async function startSession(nextMode: Mode = mode) {
		freeplay = null;
		mode = nextMode;
		store ??= progressStore(data.user?.id ?? null);
		const activeStore = store;
		const [cards, attempts] = await Promise.all([activeStore.loadCards(bundle.id), activeStore.loadAttempts(bundle.id)]);
		const next = new DrillSession({
			bundle,
			mode: nextMode,
			guided: attempts.length === 0,
			cards,
			onAttempt: (attempt) => void activeStore.recordAttempt(attempt).then(refreshStats),
			onReview: (epd, state) => void activeStore.saveCard(bundle.id, epd, state)
		});
		session = next;
		await next.start();
	}

	onMount(() => {
		void startSession();
		void refreshStats();
		return () => engine?.destroy();
	});

	const node = $derived(session?.node);
	const learnerToMove = $derived(session && ['await', 'retry', 'reveal'].includes(session.phase));
	const game = $derived(freeplay?.game ?? session?.game ?? null);
	const yourTurn = $derived(game ? game.turn === bundle.side : false);
	const pawns = (cp: number) => (cp / 100).toFixed(2);

	/** Plain-language size of a mistake: a newcomer can't read "0.39". */
	const howMuch = (cp: number) =>
		cp < 50 ? 'a little' : cp < 120 ? 'about a pawn' : cp < 250 ? 'more than a pawn' : 'a lot';

	function feedback(grade: Grade | null): { tone: 'pass' | 'soft' | 'fail'; text: string } | null {
		if (!grade) return null;
		const played = session?.lastPlayedSan ?? grade.played?.san ?? 'That move';
		if (grade.kind === 'pass') return { tone: 'pass', text: `${grade.played.san} — that's your line.` };
		if (grade.kind === 'soft') {
			return { tone: 'soft', text: `${played} is playable, but your line is ${grade.expected.san}. Play ${grade.expected.san}.` };
		}
		const cost = grade.costCp ?? grade.atLeastCp;
		const why = cost > 0 ? ` — it gives away ${howMuch(cost)}` : '';
		// During the one unhinted retry the answer must stay hidden; it is revealed only after the second miss.
		if (session?.phase === 'retry') return { tone: 'fail', text: `${played} isn't in your line${why}. One more try, no hints.` };
		return { tone: 'fail', text: `Not ${played}${why}. Here you play ${grade.expected.san} — the arrow shows it.` };
	}


	/**
	 * The one card that says what is happening: whose move, what the last move
	 * earned, and what to do now. Everything else on the page is reference.
	 */
	const notice = $derived.by((): { tone: 'pass' | 'soft' | 'fail' | 'wait' | 'accent'; title: string; text: string } => {
		if (freeplay) {
			const tone = ({ best: 'pass', good: 'pass', warn: 'soft', bad: 'fail', info: 'accent' } as const)[
				freeplay.message?.tone ?? 'info'
			];
			const title = {
				thinking: 'Computer is thinking…',
				'your-move': 'Your move — play on',
				retry: 'Try again',
				reveal: 'Play the highlighted move',
				over: 'Game over'
			}[freeplay.phase];
			return {
				tone: freeplay.phase === 'thinking' ? 'wait' : tone,
				title,
				text: freeplay.message?.text ?? "You're past the memorised moves. Every move gets a verdict, and the computer sometimes errs on purpose — punish it."
			};
		}
		if (!session) return { tone: 'wait', title: 'Loading…', text: '' };
		const verdict = feedback(session.lastGrade);
		switch (session.phase) {
			case 'opponent':
				return { tone: 'wait', title: 'Opponent is moving…', text: verdict?.text ?? '' };
			case 'await':
				return mode === 'learn'
					? { tone: 'accent', title: 'Your move', text: verdict?.text ?? 'Play the move the arrow shows.' }
					: { tone: 'accent', title: 'Your move', text: verdict?.text ?? 'From memory. What does your line play here?' };
			case 'retry':
				return { tone: 'fail', title: 'Not that — one more try', text: verdict?.text ?? '' };
			case 'reveal':
				return { tone: verdict?.tone ?? 'accent', title: 'Play the highlighted move', text: verdict?.text ?? '' };
			case 'done':
				return {
					tone: 'pass',
					title: 'Line complete',
					text:
						mode === 'learn'
							? "You've walked this line once. It counts when you play it from memory — try Practice, or keep playing against the computer."
							: 'Saved. Positions you missed will come back sooner. Next line?'
				};
		}
	});

	const pairs = $derived(movePairs(game?.history ?? []));

	// The bar holds the last known evaluation past the end of the bundle, dimmed, rather than dropping to 0.
	let lastEval = $state<Score | null>(null);
	const liveEval = $derived<Score | null>(freeplay ? freeplay.evaluation : (node?.candidates[0]?.score ?? null));
	$effect(() => {
		if (liveEval) lastEval = liveEval;
	});
	const evalScore = $derived(liveEval ?? lastEval);
	const evalStale = $derived(!liveEval);
	const percent = (value: number | null | undefined) => (value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`);
	const share = (value: number | null | undefined) => `${Math.round((value ?? 0) * 100)}%`;

	function onKey(event: KeyboardEvent) {
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if (event.key === 'n' && session?.phase === 'done' && !freeplay) void startSession();
		else if (event.key === 'k' && session?.phase === 'done' && mode === 'learn' && !freeplay) void keepPlaying();
		else if (event.key === 'l' && mode !== 'learn') void startSession('learn');
		else if (event.key === 'p' && mode !== 'practice') void startSession('practice');
	}
</script>

<svelte:head>
	<title>{bundle.name} — Lethal Chess</title>
</svelte:head>

<svelte:window onkeydown={onKey} />

<main>
	<div class="layout">
		<div class="board-column">
			<div class="eval"><EvalBar score={evalScore} side={bundle.side} stale={evalStale} /></div>
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
					onMove={(from, to, promotion) => freeplay?.submit(from, to, promotion)}
				/>
			{:else if session}
				<Board
					fen={session.game.fen}
					orientation={bundle.side}
					interactive={Boolean(learnerToMove)}
					legalTargets={session.game.legalTargets}
					needsPromotion={session.game.needsPromotion}
					marks={session.marks}
					arrows={session.arrows}
					onMove={(from, to, promotion) => session?.submit(from, to, promotion)}
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
				{#if session?.name && session.name !== bundle.name}
					<p class="variation">{session.name}</p>
				{/if}
			</header>

			<div class="modes">
				<div class="segmented" role="tablist" aria-label="Mode">
					<button type="button" role="tab" aria-selected={mode === 'learn'} onclick={() => startSession('learn')}>Learn</button>
					<button type="button" role="tab" aria-selected={mode === 'practice'} onclick={() => startSession('practice')}>Practice</button>
				</div>
				<p class="mode-hint">
					{#if mode === 'learn'}Arrows show your line — play along.{:else}From memory. One retry, then the answer.{/if}
				</p>
			</div>

			<div class="notice" data-tone={notice.tone === 'accent' ? undefined : notice.tone} aria-live="polite">
				<p class="title">
					<i class="turn" class:black={!yourTurn ? bundle.side === 'w' : bundle.side === 'b'} aria-hidden="true"></i>
					{notice.title}
				</p>
				{#if notice.text}<p class="text">{notice.text}</p>{/if}
				{#if freeplay}
					<div class="actions">
						<button type="button" class="btn" onclick={() => startSession()}>Back to drilling</button>
					</div>
				{:else if session?.phase === 'done'}
					<div class="actions">
						<button type="button" class="btn primary" onclick={() => startSession()}>Next line <kbd>N</kbd></button>
						{#if mode === 'learn'}
							<button type="button" class="btn" onclick={keepPlaying} disabled={engineLoading}>
								{engineLoading ? 'Loading engine…' : 'Keep playing'} <kbd>K</kbd>
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
					<div class="stat">
						<p class="label">Evaluation</p>
						<p class="value num">{formatScore(node.candidates[0].score)} <small>{evalWords(node.candidates[0].score)}</small></p>
					</div>
					{#if node.sharpness !== undefined}
						<div class="stat">
							<p class="label">How exact you must be</p>
							<p class="value">{SHARPNESS_WORDS[sharpnessLevel(node.sharpness)]}</p>
							<Meter level={sharpnessLevel(node.sharpness)} label="How exact you must be" />
						</div>
					{/if}
					{#if session?.phase === 'reveal' || session?.phase === 'done'}
						<p class="line num"><span class="label">Engine line</span> {node.line.slice(0, 8).join(' ')}</p>
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

			{#if stats}
				<div class="prof">
					<p class="label">{bundle.name} — your proficiency</p>
					{#each [['Played from memory', stats.coverage], ['Remembered right now', stats.retention], ['Right first time', stats.precision]] as const as [label, value] (label)}
						<div class="bar">
							<span>{label}</span>
							<span class="num">{percent(value)}</span>
							<span class="track"><span class="fill" style="width:{share(value)}"></span></span>
						</div>
					{/each}
					<p class="label small">{stats.cards} positions to learn in this opening.</p>
					<p class="label small save" data-status={sync.status ?? 'local'} role="status">
						{#if sync.status === 'synced'}
							Saved to your account.
						{:else if sync.status === 'pending'}
							Saving…
						{:else if sync.status === 'offline'}
							Can't reach the server — progress is kept on this device and will sync.
						{:else}
							Saved in this browser. <a href="/auth/google">Sign in</a> to keep it everywhere.
						{/if}
					</p>
				</div>
			{/if}
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

	.eval {
		display: flex;
		flex: none;
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

	.value small {
		margin-left: 0.3rem;
		font-family: var(--font-ui);
		font-size: 0.8rem;
		font-weight: 400;
		color: var(--text-2);
	}

	.line {
		grid-column: 1 / -1;
		margin: 0;
		font-size: 0.9rem;
	}

	.line .label {
		display: block;
		margin-bottom: 0.2rem;
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

	.bar {
		display: grid;
		grid-template-columns: 1fr auto;
		row-gap: 5px;
		font-size: 0.9rem;
	}

	.bar > span:first-child {
		color: var(--text-2);
	}

	.bar .track {
		grid-column: 1 / -1;
		height: 4px;
		border-radius: 2px;
		background: var(--surface-2);
		box-shadow: 0 0 0 1px var(--border) inset;
		overflow: hidden;
	}

	.bar .fill {
		display: block;
		height: 100%;
		border-radius: 2px;
		background: var(--accent);
	}

	.small {
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
