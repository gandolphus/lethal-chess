<script lang="ts">
	import { moveNumber, segments, type MoveNode } from '$lib/explore/movetree';

	let {
		root,
		current,
		revision = 0,
		onselect
	}: {
		root: MoveNode;
		/** The move on the board. */
		current: MoveNode;
		/** Bumped whenever the tree changes: it is mutated in place, so this is the signal to redraw. */
		revision?: number;
		onselect: (node: MoveNode) => void;
	} = $props();

	/**
	 * The game as it was played, branches and all: the line first, then everything else tried from a
	 * position, indented under it. Each move carries how good it was — the colour, not a label, since the
	 * verdict is already spelled out in the notice.
	 */
	const rows = $derived.by(() => {
		void revision;
		return segments(root);
	});

	// A number before every white move, and before a black move that starts a run.
	const numbered = (node: MoveNode, index: number) => index === 0 || node.ply % 2 === 1;
</script>

<div class="tree num" aria-label="Moves played">
	{#each rows as row, i (row.moves[0]?.id ?? i)}
		<p class="run" style="--depth: {row.depth}">
			{#each row.moves as node, index (node.id)}
				{#if numbered(node, index)}<span class="n">{moveNumber(node.ply)}</span>{/if}<button
					type="button"
					class="m"
					class:cur={node === current}
					data-quality={node.quality}
					title={node.quality ? `${node.san} — ${node.quality}` : node.san}
					onclick={() => onselect(node)}>{node.san}</button
				>
			{/each}
		</p>
	{/each}
	{#if !rows.length}
		<p class="empty">No moves yet.</p>
	{/if}
</div>

<style>
	.tree {
		display: grid;
		gap: 0.1rem;
		padding-top: 0.6rem;
		border-top: 1px solid var(--border);
		font-size: 0.95rem;
		line-height: 1.6;
		max-height: 16rem;
		overflow-y: auto;
	}

	.run {
		margin: 0;
		padding-left: calc(var(--depth) * 0.9rem);
	}

	/* A branch is quieter than the line it leaves, and marked where it starts. */
	.run:not([style*='--depth: 0']) {
		position: relative;
		font-size: 0.88rem;
		color: var(--text-2);
	}

	.run:not([style*='--depth: 0'])::before {
		content: '';
		position: absolute;
		left: calc(var(--depth) * 0.9rem - 0.45rem);
		top: 0.35em;
		bottom: 0.35em;
		border-left: 1px solid var(--border);
	}

	.n {
		margin-right: 0.15rem;
		color: var(--text-3);
	}

	.m {
		margin-right: 0.25rem;
		padding: 1px 5px;
		border: 0;
		border-radius: 4px;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.m:hover {
		background: var(--surface-2);
	}

	.m.cur {
		background: var(--surface-2);
		color: var(--text);
		font-weight: 600;
	}

	/* Quality, from winning chances given away. Book moves are theory, not a verdict. */
	.m[data-quality='book'] {
		color: var(--text-2);
	}

	.m[data-quality='best'],
	.m[data-quality='good'] {
		color: var(--ok);
	}

	.m[data-quality='inaccuracy'] {
		color: var(--soft);
	}

	.m[data-quality='mistake'],
	.m[data-quality='blunder'] {
		color: var(--bad);
	}

	.m[data-quality='blunder']::after {
		content: '??';
		margin-left: 0.1rem;
		font-size: 0.75em;
	}

	.m[data-quality='mistake']::after {
		content: '?';
		margin-left: 0.1rem;
		font-size: 0.75em;
	}

	.m[data-quality='inaccuracy']::after {
		content: '?!';
		margin-left: 0.1rem;
		font-size: 0.75em;
	}

	.empty {
		margin: 0;
		color: var(--text-3);
	}
</style>
