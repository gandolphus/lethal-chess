<script lang="ts">
	import { OPENING_GROUPS } from '$lib/drill/openings';
	import type { OpeningIndexEntry } from '$lib/drill/bundle';
	import Meter from '$lib/ui/Meter.svelte';
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

	const featured = $derived(data.openings.find((o) => o.id === 'ruy-lopez') ?? data.openings[0]);
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
				playing good moves — every move checked against a deep engine evaluation. Then drill it from memory.
			</p>
			<ol class="steps">
				<li><b>Pick</b> an opening below</li>
				<li><b>Explore</b> — discover the established lines</li>
				<li><b>Practice</b> — from memory, engine-checked</li>
			</ol>
		</div>
		{#if featured}
			<a class="featured" href="/openings/{featured.id}" aria-label="Start with the {featured.name}">
				<MiniBoard fen={fenAfter(featured.moves)} orientation={featured.side} />
				<span class="featured-label">Start with the <b>{featured.name}</b></span>
			</a>
		{/if}
	</header>

	{#each sections as section (section.side)}
		<section class="side">
			<h2><i class="stone" class:black={section.side === 'b'}></i>{section.title}</h2>
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
										<span class="lethal" title="How much precision it demands of your opponent">
											<span class="lethal-label">Lethality</span>
											<Meter level={lethality(opening)} label="Lethality" />
										</span>
										{#each opening.tags as tag (tag)}
											<span class="chip">{tag}</span>
										{/each}
									</span>
								</span>
							</a>
						</li>
					{/each}
				</ul>
			{/each}
		</section>
	{/each}
</main>

<style>
	main {
		max-width: 1080px;
		margin: 0 auto;
		padding: 2rem 1.25rem 4rem;
	}

	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 220px;
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

	.lethal {
		display: grid;
		gap: 0.25rem;
		width: 5.2rem;
		margin-right: 0.3rem;
	}

	.lethal-label {
		font-size: 0.68rem;
		color: var(--text-3);
	}

	@media (max-width: 700px) {
		main {
			padding-top: 1.4rem;
		}

		.hero {
			grid-template-columns: 1fr;
			gap: 1.5rem;
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
