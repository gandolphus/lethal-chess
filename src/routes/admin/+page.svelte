<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const s = $derived(data.stats);
	const maxAttempts = $derived(Math.max(1, ...s.attemptsPerDay.map((d) => d.attempts)));
	const name = (id: string) => id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	const num = (n: number) => n.toLocaleString('en');
	// The audit measured ~400 bytes a row with its indexes; near enough to read "how full is it".
	const megabytes = (rows: number) => ((rows * 400) / 1_000_000).toFixed(1);
</script>

<svelte:head>
	<title>Admin — Lethal Chess</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main>
	<h1>Site stats</h1>
	<p class="lede">
		Signed-in learners only. Visitors and where they came from are in
		<a href="https://dash.cloudflare.com/" target="_blank" rel="noopener">Cloudflare → Web Analytics</a>.
	</p>

	<section class="tiles">
		<div><span class="n num">{s.users.total}</span><span>accounts</span><small>+{s.users.newLast7Days} this week</small></div>
		<div><span class="n num">{s.activeLearners.today}</span><span>learners today</span></div>
		<div><span class="n num">{s.activeLearners.last7Days}</span><span>learners this week</span></div>
		<div><span class="n num">{s.activeLearners.last30Days}</span><span>learners, 30 days</span></div>
		<div>
			<span class="n num">{s.practice.passRate === null ? '—' : `${Math.round(s.practice.passRate * 100)}%`}</span>
			<span>right first time</span><small>{s.practice.firstTries} practice moves</small>
		</div>
	</section>

	<section>
		<h2>Moves drilled per day (14 days)</h2>
		{#if s.attemptsPerDay.length}
			<ol class="bars">
				{#each s.attemptsPerDay as d (d.day)}
					<li>
						<span class="day num">{d.day.slice(5)}</span>
						<span class="track"><span class="fill" style="width:{(d.attempts / maxAttempts) * 100}%"></span></span>
						<span class="num">{d.attempts} · {d.learners} {d.learners === 1 ? 'learner' : 'learners'}</span>
					</li>
				{/each}
			</ol>
		{:else}
			<p class="empty">No drilling by signed-in learners yet.</p>
		{/if}
	</section>

	<section>
		<h2>Most-drilled openings (30 days)</h2>
		{#if s.topOpenings.length}
			<table>
				<thead><tr><th>Opening</th><th>Learners</th><th>Moves</th></tr></thead>
				<tbody>
					{#each s.topOpenings as o (o.bundleId)}
						<tr><td>{name(o.bundleId)}</td><td class="num">{o.learners}</td><td class="num">{o.attempts}</td></tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<p class="empty">Nothing yet.</p>
		{/if}
	</section>

	<section>
		<h2>Storage</h2>
		<p class="lede">
			What the per-account row quota bounds. The heaviest account is at
			<b>{Math.round((s.storage.largestAccount / s.storage.quota) * 100)}%</b> of its
			{num(s.storage.quota)}-row ceiling.
		</p>
		<table>
			<thead><tr><th>Table</th><th>Rows</th></tr></thead>
			<tbody>
				{#each s.storage.byTable as t (t.table)}
					<tr><td>{t.table.replace('_', ' ')}</td><td class="num">{num(t.rows)}</td></tr>
				{/each}
				<tr class="total"><td>all accounts</td><td class="num">{num(s.storage.rows)} · ~{megabytes(s.storage.rows)} MB</td></tr>
			</tbody>
		</table>
	</section>
</main>

<style>
	.total td {
		border-top: 1px solid var(--border);
		font-weight: 600;
		color: var(--text);
	}

	main {
		max-width: 860px;
		margin: 0 auto;
		padding: 2rem 1.25rem 4rem;
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 2.2rem;
	}

	.lede,
	.empty {
		color: var(--text-2);
	}

	.lede a {
		color: var(--accent);
	}

	h2 {
		margin: 2rem 0 0.7rem;
		font-size: 1rem;
		font-weight: 600;
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 0.6rem;
		margin-top: 1.5rem;
	}

	.tiles div {
		display: flex;
		flex-direction: column;
		padding: 0.8rem 0.9rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface-1);
		color: var(--text-2);
		font-size: 0.85rem;
	}

	.tiles .n {
		font-size: 1.8rem;
		color: var(--text);
	}

	.tiles small {
		color: var(--text-3);
	}

	.bars {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.3rem;
		font-size: 0.85rem;
	}

	.bars li {
		display: grid;
		grid-template-columns: 3rem 1fr 9rem;
		align-items: center;
		gap: 0.6rem;
		color: var(--text-2);
	}

	.track {
		height: 0.6rem;
		border-radius: 999px;
		background: var(--surface-2);
		overflow: hidden;
	}

	.fill {
		display: block;
		height: 100%;
		background: var(--accent);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	th,
	td {
		padding: 0.45rem 0.3rem;
		border-bottom: 1px solid var(--border);
		text-align: left;
	}

	th {
		color: var(--text-2);
		font-weight: 500;
	}
</style>
