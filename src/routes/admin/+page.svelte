<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const s = $derived(data.stats);
	const maxAttempts = $derived(Math.max(1, ...s.attemptsPerDay.map((d) => d.attempts)));
	const name = (id: string) => id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	const num = (n: number) => n.toLocaleString('en');

	/** "4 min ago", "yesterday", "12 Sep" — close enough to answer "is this person still coming back". */
	function when(ms: number | null) {
		if (!ms) return 'never';
		const mins = Math.round((Date.now() - ms) / 60_000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins} min ago`;
		const hours = Math.round(mins / 60);
		if (hours < 24) return `${hours} h ago`;
		const days = Math.round(hours / 24);
		if (days === 1) return 'yesterday';
		if (days < 30) return `${days} days ago`;
		return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
	}

	/** Active in the last two days: the dot that says "yes, they are using it". */
	const isLive = (ms: number | null) => Boolean(ms && Date.now() - ms < 2 * 86_400_000);
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
		<h2>Reports <span class="tag">{data.reports.length}</span></h2>
		<p class="lede">What testers wrote on <a href="/report">/report</a>, newest first.</p>
		{#if data.reports.length}
			<ol class="reports">
				{#each data.reports as r (r.id)}
					<li data-kind={r.kind}>
						<p class="head">
							<b>{r.kind === 'bug' ? 'Bug' : r.kind === 'idea' ? 'Idea' : 'Other'}</b>
							<span>{r.name ?? r.contact ?? 'anonymous'}</span>
							<span class="dim">{when(r.createdAt)}</span>
						</p>
						<p class="body pick-text">{r.body}</p>
						<p class="meta">
							{#if r.path}<code>{r.path}</code>{/if}
							{r.browser}{#if r.viewport} · {r.viewport}{/if}{#if r.appVersion} · build {r.appVersion.slice(0, 8)}{/if}
							{#if r.email}· <span class="pick-text">{r.email}</span>{/if}
						</p>
					</li>
				{/each}
			</ol>
		{:else}
			<p class="empty">Nothing reported yet.</p>
		{/if}
	</section>

	<section>
		<h2>Accounts</h2>
		<p class="lede">Most recently active first. How much each person has done and when — never what they played.</p>
		{#if s.accounts.length}
			<table class="accounts">
				<thead>
					<tr>
						<th>Who</th><th>Last seen</th><th class="r">Found</th><th class="r">Openings</th>
						<th class="r">Moves</th><th class="r">Reviews</th><th class="r">Joined</th>
					</tr>
				</thead>
				<tbody>
					{#each s.accounts as a (a.id)}
						<tr>
							<td>
								<span class="who">
									<i class="dot" class:live={isLive(a.lastActive)} aria-hidden="true"></i>
									<span>
										<b>{a.name}</b>
										<small class="pick-text">{a.email}</small>
									</span>
								</span>
							</td>
							<td class:dim={!a.lastActive}>{when(a.lastActive)}</td>
							<td class="r num">{num(a.discovered)}{#if a.entered}<small> +{a.entered}</small>{/if}</td>
							<td class="r num">{a.openings || '—'}</td>
							<td class="r num">{num(a.attempts)}</td>
							<td class="r num">{num(a.reviews)}</td>
							<td class="r num dim">{when(a.joined)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="foot">
				<b>Found</b> is lines discovered, with lines entered but not finished after the <b>+</b>.
				<b>Moves</b> counts drilled moves in Practice; exploring records discoveries instead.
			</p>
		{:else}
			<p class="empty">Nobody has signed in yet.</p>
		{/if}
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

	.r {
		text-align: right;
	}

	.dim {
		color: var(--text-3);
	}

	.accounts td {
		color: var(--text-2);
		vertical-align: top;
	}

	.who {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.who b {
		display: block;
		color: var(--text);
		font-weight: 600;
	}

	.who small {
		color: var(--text-3);
		font-size: 0.8rem;
	}

	/* Lit for anyone who did something in the last two days — the answer at a glance. */
	.dot {
		flex: none;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--surface-2);
		box-shadow: 0 0 0 1px var(--border) inset;
	}

	.dot.live {
		background: var(--ok);
		box-shadow: none;
	}

	.tag {
		display: inline-block;
		margin-left: 0.3rem;
		padding: 0 0.4rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--text-2);
		font-size: 0.8rem;
		font-weight: 500;
	}

	.reports {
		display: grid;
		gap: 0.6rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.reports li {
		padding: 0.7rem 0.9rem;
		border: 1px solid var(--border);
		border-left: 3px solid var(--border);
		border-radius: 10px;
		background: var(--surface-1);
	}

	.reports li[data-kind='bug'] {
		border-left-color: var(--bad);
	}

	.reports li[data-kind='idea'] {
		border-left-color: var(--accent);
	}

	.reports .head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem;
		margin: 0;
		font-size: 0.85rem;
		color: var(--text-2);
	}

	.reports .head b {
		color: var(--text);
	}

	/* The reporter's own words, exactly as they typed them, line breaks and all. */
	.reports .body {
		margin: 0.4rem 0 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.reports .meta {
		margin: 0.45rem 0 0;
		font-size: 0.78rem;
		color: var(--text-3);
	}

	.reports code {
		padding: 0.05rem 0.3rem;
		border-radius: 4px;
		background: var(--surface-2);
		font-size: 0.95em;
	}

	.foot {
		margin: 0.6rem 0 0;
		font-size: 0.8rem;
		color: var(--text-3);
	}

	.foot b {
		color: var(--text-2);
		font-weight: 500;
	}

	@media (max-width: 620px) {
		.accounts :is(th, td):nth-child(5),
		.accounts :is(th, td):nth-child(7) {
			display: none;
		}

		.who small {
			display: none;
		}
	}
</style>
