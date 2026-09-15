<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { IndexedLine, LineStage } from '$lib/explore/book';
	import { layout, type Here, type Zoom } from '$lib/explore/linemap';

	let {
		lines,
		stages,
		here = null,
		zoom: initialZoom,
		opening,
		openingLabel,
		title,
		band = null,
		onclose
	}: {
		lines: IndexedLine[];
		stages: Map<string, LineStage>;
		/** The node the game has reached. */
		here?: Here | null;
		zoom?: Zoom;
		/** Plies of the opening's defining moves: the chart starts after them. */
		opening: number;
		/** Label for the first column, e.g. "3.Bb5". */
		openingLabel?: string;
		title: string;
		/** A variation to scroll to when the map opens. */
		band?: string | null;
		onclose?: () => void;
	} = $props();

	/**
	 * The chart: the opening as a tree of lines, one band per variation. Discovered lines are lit,
	 * entered ones warm, everything else fog — structure without names or moves. Two zooms: Overview
	 * fits the width; Detail writes the moves the learner has played and names the ends they reached.
	 */
	let chosenZoom = $state<Zoom | null>(null);
	const zoom = $derived<Zoom>(
		chosenZoom ?? initialZoom ?? (typeof matchMedia !== 'undefined' && matchMedia('(max-width: 860px)').matches ? 'overview' : 'detail')
	);
	let width = $state(0);
	const collapsed = new SvelteSet<string>();
	let scroller = $state<HTMLElement | null>(null);
	let closeButton = $state<HTMLButtonElement | null>(null);

	const chart = $derived(layout(lines, stages, { zoom, width: Math.max(320, width), opening, openingLabel, here, collapsed }));

	const toggle = (name: string) => (collapsed.has(name) ? collapsed.delete(name) : collapsed.add(name));

	// On open: focus the close button, and scroll to the band asked for.
	$effect(() => {
		closeButton?.focus();
	});
	$effect(() => {
		const target = band;
		if (!scroller || !target || width === 0) return;
		const found = chart.bands.find((b) => b.name === target);
		if (!found) return;
		const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
		scroller.scrollTo({ top: Math.max(0, found.y - 12), behavior: smooth ? 'smooth' : 'auto' });
	});

	function onKey(event: KeyboardEvent) {
		if (event.key === 'Escape' && onclose) {
			event.preventDefault();
			onclose();
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<section class="linemap" aria-label="Line map">
	<header class="head">
		<h2>{title}</h2>
		<span class="legend" aria-hidden="true">
			<span><i class="lit"></i>found</span>
			<span><i class="ember"></i>in progress</span>
			<span><i class="fog"></i>secret</span>
		</span>
		<span class="spacer"></span>
		<div class="segmented" role="group" aria-label="Zoom">
			<button type="button" aria-pressed={zoom === 'overview'} onclick={() => (chosenZoom = 'overview')}>Overview</button>
			<button type="button" aria-pressed={zoom === 'detail'} onclick={() => (chosenZoom = 'detail')}>Detail</button>
		</div>
		{#if onclose}
			<button type="button" class="btn close" onclick={onclose} bind:this={closeButton}>Close <kbd>Esc</kbd></button>
		{/if}
	</header>

	<div class="scroll" bind:this={scroller} bind:clientWidth={width}>
		<svg class="map" width={chart.width} height={chart.height} viewBox="0 0 {chart.width} {chart.height}" role="img" aria-label="{title}: each variation's lines as a tree, lit where discovered">
			{#each chart.ruler as tick (tick.x)}
				<text class="ply" x={tick.x} y="16" text-anchor="middle">{tick.label}</text>
			{/each}

			{#each chart.bands as b (b.name)}
				<g class="band" class:here={b.here}>
					<line class="band-line" x1="8" x2={chart.width - 8} y1={b.y - 4} y2={b.y - 4} />
					<text
						class="band-name"
						x="12"
						y={b.y + 13}
						role="button"
						tabindex="0"
						aria-expanded={!b.collapsed}
						onclick={() => toggle(b.name)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								toggle(b.name);
							}
						}}
					>
						<tspan class="chevron">{b.collapsed ? '▸' : '▾'}</tspan>
						<tspan dx="3">{b.label}</tspan>
						{#if zoom === 'overview' || b.collapsed}<tspan class="band-count" dx="8">{b.count}</tspan>{/if}
					</text>
					{#if zoom === 'detail' && !b.collapsed}
						<text class="band-count" x="12" y={b.y + 27}>{b.count}</text>
					{/if}
				</g>
			{/each}

			{#each chart.edges as edge}
				<path class="edge {edge.state}" d={edge.d} />
				{#if edge.label}
					<text class="move {edge.state}" x={edge.label.x} y={edge.label.y} text-anchor="end">{edge.label.text}</text>
				{/if}
			{/each}

			{#each chart.nodes as node}
				<circle class="node {node.kind}" cx={node.x} cy={node.y} r={node.r} />
				{#if node.label}
					<text class="end-name" x={node.x + 8} y={node.y + 4}>{node.label}</text>
				{/if}
			{/each}

			{#if chart.here}
				<circle class="node here" cx={chart.here.x} cy={chart.here.y} r="4" />
				<circle class="here-ring" cx={chart.here.x} cy={chart.here.y} r="6" />
			{/if}
		</svg>
	</div>
</section>

<style>
	.linemap {
		--lit: var(--ok);
		--ember: var(--accent);
		--fog: color-mix(in srgb, var(--text-3) 60%, transparent);
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		background: var(--surface-1);
		color: var(--text);
	}

	/* Monochrome themes: found and accent are both white there; the signal colour tells "in progress" apart. */
	:global([data-theme='graphite']) .linemap,
	:global([data-theme='vellum']) .linemap {
		--ember: var(--signal);
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
		padding: 0.7rem 0.9rem;
		border-bottom: 1px solid var(--border);
	}

	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.25rem;
	}

	.legend {
		display: flex;
		gap: 0.9rem;
		font-size: 0.78rem;
		color: var(--text-2);
	}

	.legend i {
		display: inline-block;
		width: 0.8rem;
		height: 3px;
		margin-right: 0.35rem;
		vertical-align: middle;
		border-radius: 2px;
	}

	.legend .lit {
		background: var(--lit);
	}

	.legend .ember {
		background: var(--ember);
	}

	.legend .fog {
		background: repeating-linear-gradient(90deg, var(--fog) 0 2px, transparent 2px 4px);
	}

	.spacer {
		flex: 1;
	}

	.close {
		padding: 0.3rem 0.65rem;
		font-size: 0.85rem;
	}

	.scroll {
		flex: 1;
		min-height: 0;
		overflow: auto;
		overscroll-behavior: contain;
	}

	svg.map {
		display: block;
		font-family: var(--font-ui);
	}

	.band-line {
		stroke: var(--border);
	}

	.band-name {
		font-size: 12.5px;
		font-weight: 500;
		fill: var(--text);
		cursor: pointer;
		user-select: none;
	}

	.band-name:hover,
	.band-name:focus-visible {
		fill: var(--ember);
		outline: none;
	}

	.band.here .band-name {
		fill: var(--ember);
	}

	.chevron {
		fill: var(--text-3);
		font-size: 10px;
	}

	.band-count {
		font-size: 11px;
		font-weight: 400;
		font-family: var(--font-num);
		fill: var(--text-3);
	}

	.edge {
		fill: none;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.edge.fog {
		stroke: var(--fog);
		stroke-width: 1;
		stroke-dasharray: 1.5 3.5;
	}

	.edge.ember {
		stroke: var(--ember);
		stroke-width: 2;
	}

	.edge.ember-dim {
		stroke: var(--ember);
		stroke-width: 1.4;
		stroke-dasharray: 3 4;
		opacity: 0.55;
	}

	.edge.lit {
		stroke: var(--lit);
		stroke-width: 2;
	}

	.node {
		fill: var(--surface-1);
		stroke: var(--fog);
		stroke-width: 1;
	}

	.node.lit {
		fill: var(--lit);
		stroke: var(--lit);
	}

	.node.ember {
		stroke: var(--ember);
		stroke-width: 1.6;
	}

	.node.here {
		fill: var(--ember);
		stroke: var(--ember);
	}

	.move {
		font-size: 10px;
		font-family: var(--font-num);
		fill: var(--text-2);
	}

	.move.lit {
		fill: var(--text);
	}

	.end-name {
		font-size: 11.5px;
		fill: var(--text);
	}

	.ply {
		font-size: 10px;
		font-family: var(--font-num);
		fill: var(--text-3);
	}

	.here-ring {
		fill: none;
		stroke: var(--ember);
		stroke-width: 1;
		opacity: 0.6;
		transform-box: fill-box;
		transform-origin: center;
		animation: ring 2.4s ease-out infinite;
	}

	@keyframes ring {
		0% {
			transform: scale(0.6);
			opacity: 0.8;
		}
		100% {
			transform: scale(2.2);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.here-ring {
			animation: none;
		}
	}

	@media (max-width: 860px) {
		.head {
			gap: 0.4rem 0.7rem;
			padding: 0.6rem 0.75rem;
		}

		/* Title on its own row, then the zoom and Close, then the legend. */
		h2 {
			width: 100%;
			font-size: 1.1rem;
		}

		.spacer {
			display: none;
		}

		.close {
			margin-left: auto;
		}

		.legend {
			order: 5;
			width: 100%;
		}
	}
</style>
