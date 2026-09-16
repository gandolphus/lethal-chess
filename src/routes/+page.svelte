<script lang="ts">
	import { onMount } from 'svelte';
	import { OPENING_GROUPS } from '$lib/drill/openings';
	import { BrowserProgressStore } from '$lib/drill/progress';
	import { stagesOf } from '$lib/explore/book';
	import type { OpeningIndexEntry } from '$lib/drill/bundle';
	import MiniBoard from '$lib/ui/MiniBoard.svelte';
	import { fenAfter } from '$lib/ui/position';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Openings are chosen by colour first, then by first move — the way a player thinks about them.
	const SIDES = [
		{ side: 'w', title: 'You play White', groups: ['white-e4', 'white-d4', 'white-flank'] },
		{ side: 'b', title: 'You play Black', groups: ['black-e4', 'black-d4'] }
	] as const;

	const sections = $derived(
		SIDES.map((s) => ({
			...s,
			groups: OPENING_GROUPS.filter((g) => (s.groups as readonly string[]).includes(g.id))
				.map((g) => ({
					...g,
					label: g.label.replace(/^(White|Black) · /, ''),
					openings: data.openings.filter((o) => o.group === g.id)
				}))
				.filter((g) => g.openings.length)
		})).filter((s) => s.groups.length)
	);

	// How much the opening punishes imprecise opponents: the mean centipawns their
	// second-best moves give up. The scale tops out well below the outliers.
	const lethality = (o: OpeningIndexEntry) => {
		const cp = o.opponentSharpness ?? 0;
		return cp >= 60 ? 5 : cp >= 42 ? 4 : cp >= 30 ? 3 : cp >= 20 ? 2 : 1;
	};

	// Lines discovered and entered per opening, from this browser's copy of the learner's progress (no network).
	type Progress = { discovered: number; entered: number; last: string };
	let found = $state<Record<string, Progress>>({});
	onMount(() => {
		let store: BrowserProgressStore;
		try {
			store = new BrowserProgressStore(localStorage, data.user ? `user:${data.user.id}` : '');
		} catch {
			return; // storage blocked: no counts, the picker works without them
		}
		void Promise.all(
			data.openings.map(async (o) => {
				const dubious = new Set(o.dubiousLines ?? []);
				const discoveries = await store.loadDiscoveries(o.id);
				const sound = [...stagesOf(discoveries)].filter(([line]) => !dubious.has(line));
				const progress: Progress = {
					discovered: sound.filter(([, stage]) => stage === 'discovered').length,
					entered: sound.filter(([, stage]) => stage === 'entered').length,
					last: discoveries.reduce((latest, d) => (d.at > latest ? d.at : latest), '')
				};
				return [o.id, progress] as const;
			})
		).then((counts) => (found = Object.fromEntries(counts)));
	});

	const featured = $derived(data.openings.find((o) => o.id === 'ruy-lopez') ?? data.openings[0]);

	/** The opening explored most recently, once there is any progress. */
	const resume = $derived.by(() => {
		const recent = data.openings.filter((o) => found[o.id]?.last).sort((a, b) => found[b.id].last.localeCompare(found[a.id].last))[0];
		return recent ? { opening: recent, progress: found[recent.id] } : null;
	});

	/**
	 * An opening's shape: one segment per variation, as wide as its lines. The found and entered counts are
	 * laid in from the largest variation, since the picker doesn't know which variation each line is in.
	 */
	function spine(sizes: number[], { discovered, entered }: Pick<Progress, 'discovered' | 'entered'>) {
		let d = discovered;
		let e = entered;
		return sizes.map((n) => {
			const lit = Math.min(n, d);
			d -= lit;
			const warm = Math.min(n - lit, e);
			e -= warm;
			return { n, lit: lit / n, warm: warm / n };
		});
	}

	const tally = (openings: OpeningIndexEntry[]) =>
		openings.reduce((t, o) => ({ found: t.found + (found[o.id]?.discovered ?? 0), lines: t.lines + (o.lines ?? 0) }), { found: 0, lines: 0 });
</script>

<svelte:head>
	<title>Lethal Chess — learn an opening, then drill it</title>
</svelte:head>

<main>
	<header class="hero">
		<div class="pitch">
			<h1>Know your openings cold.</h1>
			<p>
				Pick an opening you want to play. Explore it: the established lines are hidden, and you find them by
				playing good moves — every move checked against a deep engine evaluation. Then the lines you find come
				back for review, spaced so they stick.
			</p>
			<ol class="steps">
				<li><b>Pick</b> an opening below</li>
				<li><b>Explore</b> — discover the established lines</li>
				<li><b>Today</b> — replay what you found, just before you'd forget it</li>
			</ol>
		</div>
		{#if resume}
			{@const { opening, progress } = resume}
			<a class="resume" href="/openings/{opening.id}" aria-label="Continue exploring the {opening.name}">
				<span class="diagram"><MiniBoard fen={fenAfter(opening.moves)} orientation={opening.side} /></span>
				<span>
					<span class="resume-kicker">Continue where you left off</span>
					<span class="resume-title">{opening.name} <span class="num">{progress.discovered} of {opening.lines} lines</span></span>
				</span>
				{@render spineOf(opening, progress)}
				<span class="resume-foot">
					<span>{progress.entered ? `${progress.entered} entered, not finished` : 'Keep exploring'}</span>
					<span class="btn small primary">Explore</span>
				</span>
			</a>
		{:else if featured}
			<a class="featured" href="/openings/{featured.id}" aria-label="Start with the {featured.name}">
				<MiniBoard fen={fenAfter(featured.moves)} orientation={featured.side} />
				<span class="featured-label">Start with the <b>{featured.name}</b></span>
			</a>
		{/if}
	</header>

	{#each sections as section (section.side)}
		<section class="side">
			<h2>
				<i class="stone" class:black={section.side === 'b'}></i>{section.title}
				{#if tally(section.groups.flatMap((g) => g.openings)).found}
					{@const sideTally = tally(section.groups.flatMap((g) => g.openings))}
					<span class="tally num">{sideTally.found} of {sideTally.lines} lines found</span>
				{/if}
			</h2>
			{#each section.groups as group (group.id)}
				<h3 class="num">{group.label}</h3>
				<ul class="openings">
					{#each group.openings as opening (opening.id)}
						<li>
							<a href="/openings/{opening.id}">
								<span class="diagram"><MiniBoard fen={fenAfter(opening.moves)} orientation={opening.side} /></span>
								<span class="body">
									<span class="name">{opening.name}</span>
									<span class="moves num">{opening.moves}</span>
									<span class="foot">
										<span class="lethal" title="Lethality: how much precision it demands of your opponent" role="img" aria-label="Lethality {lethality(opening)} of 5">
											Lethality
											{#each [1, 2, 3, 4, 5] as dot (dot)}<i class:on={dot <= lethality(opening)}></i>{/each}
										</span>
										{#each opening.tags as tag (tag)}
											<span class="chip">{tag}</span>
										{/each}
									</span>
								</span>
								{#if opening.lines}
									{@const progress = found[opening.id] ?? { discovered: 0, entered: 0, last: '' }}
									<span class="progress">
										{@render spineOf(opening, progress)}
										<span class="progress-row">
											<span class:untouched={!progress.discovered && !progress.entered}>
												{progress.discovered || progress.entered
													? `${progress.discovered} of ${opening.lines} lines found`
													: `${opening.lines} lines, none found yet`}
											</span>
											<span class="num">{opening.variations?.length ?? 0} variations</span>
										</span>
									</span>
								{/if}
							</a>
						</li>
					{/each}
				</ul>
			{/each}
		</section>
	{/each}
</main>

{#snippet spineOf(opening: OpeningIndexEntry, progress: Pick<Progress, 'discovered' | 'entered'>)}
	<span class="spine" aria-hidden="true">
		{#each spine(opening.variations ?? [opening.lines ?? 1], progress) as segment, i (i)}
			<i style="--n: {segment.n}; --lit: {segment.lit}; --warm: {segment.lit + segment.warm}"></i>
		{/each}
	</span>
{/snippet}

<style>
	main {
		max-width: var(--page-max);
		margin: 0 auto;
		padding: 2rem 1.25rem 4rem;
	}

	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(220px, 340px);
		gap: 2.5rem;
		align-items: center;
		padding-bottom: 2rem;
		margin-bottom: 1rem;
		border-bottom: 1px solid var(--border);
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(2.2rem, 5.5vw, 3.4rem);
		line-height: 1.02;
		letter-spacing: -0.015em;
	}

	.pitch p {
		max-width: 56ch;
		margin: 1rem 0 1.3rem;
		font-size: 1.05rem;
		line-height: 1.55;
		color: var(--text-2);
	}

	.steps {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.6rem;
		margin: 0;
		padding: 0;
		list-style: none;
		counter-reset: step;
		color: var(--text-2);
		font-size: 0.95rem;
	}

	.steps li {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}

	.steps li::before {
		counter-increment: step;
		content: counter(step);
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		border: 1px solid var(--accent);
		color: var(--accent);
		font-family: var(--font-num);
		font-size: 0.8rem;
	}

	.steps b {
		color: var(--text);
		font-weight: 600;
	}

	.featured {
		display: grid;
		gap: 0.6rem;
		color: var(--text-2);
		font-size: 0.9rem;
		text-decoration: none;
		text-align: center;
	}

	.featured b {
		color: var(--text);
		font-weight: 600;
	}

	.side {
		margin-top: 2.2rem;
	}

	h2 {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0 0 0.2rem;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.7rem;
		letter-spacing: -0.01em;
	}

	.stone {
		width: 0.9rem;
		height: 0.9rem;
		border-radius: 50%;
		background: var(--pw1);
		box-shadow: 0 0 0 1.5px var(--pws) inset;
	}

	.stone.black {
		background: var(--pb2);
		box-shadow: 0 0 0 1.5px var(--pbh) inset;
	}

	h3 {
		margin: 1.2rem 0 0.6rem;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--text-2);
	}

	.openings {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 0.7rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.openings a {
		display: grid;
		grid-template-columns: 88px minmax(0, 1fr);
		gap: 0.9rem;
		height: 100%;
		padding: 0.7rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface-1);
		color: inherit;
		text-decoration: none;
	}

	.openings a:hover,
	.openings a:focus-visible {
		border-color: var(--accent);
		outline: none;
	}

	.diagram {
		display: block;
		align-self: center;
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.name {
		font-size: 1.1rem;
		font-weight: 600;
		line-height: 1.2;
	}

	.moves {
		font-size: 0.82rem;
		color: var(--text-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem;
		margin-top: auto;
		padding-top: 0.5rem;
	}

	/* ── Spine: one segment per variation; found lit, entered warm, secret fogged ── */
	.spine {
		display: flex;
		gap: 2px;
		height: 7px;
	}

	.spine i {
		position: relative;
		flex: var(--n) 1 0;
		min-width: 3px;
		border-radius: 2px;
		overflow: hidden;
		background: repeating-linear-gradient(
			90deg,
			color-mix(in srgb, var(--text-3) 30%, transparent) 0 2px,
			transparent 2px 4px
		);
	}

	.spine i::before,
	.spine i::after {
		content: '';
		position: absolute;
		inset: 0 auto 0 0;
	}

	.spine i::before {
		width: calc(var(--warm) * 100%);
		background: color-mix(in srgb, var(--accent) 45%, transparent);
	}

	.spine i::after {
		width: calc(var(--lit) * 100%);
		background: var(--ok);
	}

	.progress {
		grid-column: 1 / -1;
		display: grid;
		gap: 0.35rem;
	}

	.progress-row {
		display: flex;
		justify-content: space-between;
		font-size: 0.76rem;
		color: var(--text-2);
	}

	.progress-row .untouched,
	.progress-row .num {
		color: var(--text-3);
	}

	.lethal {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin-right: 0.3rem;
		font-size: 0.72rem;
		color: var(--text-3);
	}

	.lethal i {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--text-3) 35%, transparent);
	}

	.lethal i.on {
		background: var(--text-2);
	}

	h2 .tally {
		margin-left: auto;
		font-family: var(--font-ui);
		font-size: 0.85rem;
		color: var(--text-2);
	}

	.resume {
		display: grid;
		grid-template-columns: 96px 1fr;
		gap: 0.8rem 1rem;
		align-items: center;
		padding: 0.9rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface-1);
		color: inherit;
		text-decoration: none;
	}

	.resume:hover {
		border-color: var(--accent);
	}

	.resume-kicker {
		display: block;
		font-size: 0.8rem;
		color: var(--text-2);
	}

	.resume-title {
		display: block;
		text-wrap: balance;
		font-family: var(--font-display);
		font-size: 1.45rem;
		line-height: 1.15;
	}

	.resume-title .num {
		font-family: var(--font-ui);
		font-size: 0.95rem;
		color: var(--text-2);
	}

	.resume .spine,
	.resume-foot {
		grid-column: 1 / -1;
	}

	.resume-foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.82rem;
		color: var(--text-2);
	}

	@media (max-width: 700px) {
		main {
			padding-top: 1.4rem;
		}

		.hero {
			display: flex;
			flex-direction: column;
			gap: 1.5rem;
		}

		/* On a phone the thing to tap comes before the pitch. */
		.resume {
			order: -1;
		}

		.featured {
			grid-template-columns: 120px 1fr;
			align-items: center;
			text-align: left;
		}

		.openings {
			grid-template-columns: 1fr;
		}
	}
</style>
