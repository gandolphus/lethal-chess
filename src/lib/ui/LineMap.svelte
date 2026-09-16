<script lang="ts">
	import type { IndexedLine, LineStage } from '$lib/explore/book';
	import { layout, sanOf, type Here, type LayoutMove, type Zoom } from '$lib/explore/linemap';
	import MiniBoard from '$lib/ui/MiniBoard.svelte';

	let {
		lines,
		stages,
		here = null,
		zoom: initialZoom,
		opening,
		openingLabel,
		title,
		band = null,
		side = 'w',
		onclose,
		onplay
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
		/** Which way up the tooltip's diagram sits. */
		side?: 'w' | 'b';
		onclose?: () => void;
		/** Picks up a found line: the map hands back the line, the page replays it. */
		onplay?: (line: IndexedLine) => void;
	} = $props();

	/**
	 * The chart: the opening as a tree of lines, one band per variation. Discovered lines are lit,
	 * entered ones warm, everything else fog — structure without names or moves.
	 *
	 * Detail, always: it writes the moves the learner has played and names the ends they reached, and the
	 * fitted Overview turned out to be the one nobody wanted. `layout` still takes the other, so a caller
	 * can ask for it and the control can come back, but nothing offers it.
	 */
	const zoom = $derived<Zoom>(initialZoom ?? 'detail');
	let width = $state(0);
	let scroller = $state<HTMLElement | null>(null);
	let closeButton = $state<HTMLButtonElement | null>(null);

	// A thumb needs a bigger target than a cursor: coarse pointers get taller rows.
	const touch = typeof matchMedia === 'function' && matchMedia('(hover: none) and (pointer: coarse)').matches;
	// Whether *this* interaction was a tap, which is what decides if it needs confirming — a stylus or a
	// mouse on a touchscreen is precise enough to act on directly.
	let tapped = $state(false);
	// Raw: a proxied line would not compare equal to the one the layout holds.
	let asked = $state.raw<IndexedLine | null>(null);

	const chart = $derived(layout(lines, stages, { zoom, width: Math.max(320, width), opening, openingLabel, here, touch }));

	/** On a cursor a click plays. On a thumb it asks first, naming the line, so a mis-tap costs nothing. */
	function pick(line: IndexedLine) {
		if (!onplay) return;
		if (tapped) asked = line;
		else onplay(line);
	}

	const asks = $derived(asked ? `${asked.name} — ${sanOf(asked).slice(-1)[0]}` : '');

	/**
	 * The move under the pointer. Matched by proximity rather than by giving every bead its own element:
	 * a big opening has a thousand of them, and a linear scan per pointer move costs nothing.
	 */
	let hover = $state.raw<{ move: LayoutMove; x: number; y: number } | null>(null);
	let svg = $state<SVGSVGElement | null>(null);
	let panel = $state<HTMLElement | null>(null);

	function track(event: PointerEvent) {
		if (event.pointerType === 'touch' || !svg || !panel) return;
		const box = svg.getBoundingClientRect();
		const frame = panel.getBoundingClientRect();
		const px = ((event.clientX - box.left) / box.width) * chart.width;
		const py = ((event.clientY - box.top) / box.height) * chart.height;
		const reach = touch ? 16 : 12;
		let best: LayoutMove | null = null;
		let bestDistance = reach;
		for (const move of chart.moves) {
			if (!move.line) continue;
			const distance = Math.hypot(move.x - px, move.y - py);
			if (distance < bestDistance) {
				best = move;
				bestDistance = distance;
			}
		}
		hover = best ? { move: best, x: event.clientX - frame.left, y: event.clientY - frame.top } : null;
	}

	/** The position the hovered move arrives at, as an EPD — which is a FEN the diagram can read. */
	const peek = $derived.by(() => {
		if (!hover?.move.line) return null;
		const { line, ply } = hover.move;
		return { epd: line.epds[ply], san: sanOf(line)[ply - 1], ply, name: line.name };
	});

	/** "12." before a white move, "12…" before a black one. */
	const moveNumber = (ply: number) => (ply % 2 === 1 ? `${(ply + 1) / 2}.` : `${ply / 2}…`);

	/** Every bead of one state on a single path: a zero-length subpath draws a dot under a round cap. */
	const beads = (state: string) =>
		chart.moves
			.filter((m) => m.state === state && !m.end)
			.map((m) => `M${m.x} ${m.y}h0`)
			.join('');

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

<section class="linemap" aria-label="Line map" bind:this={panel} onpointerdown={(e) => (tapped = e.pointerType === 'touch')}>
	<header class="head">
		<h2>{title}</h2>
		<span class="legend" aria-hidden="true">
			<span><i class="lit"></i>found</span>
			<span><i class="ember"></i>in progress</span>
			<span><i class="fog"></i>secret</span>
		</span>
		<span class="spacer"></span>
		{#if onclose}
			<button type="button" class="btn close" onclick={onclose} bind:this={closeButton}>Close <kbd>Esc</kbd></button>
		{/if}
	</header>

	<div class="scroll" bind:this={scroller} bind:clientWidth={width}>
		<svg
			class="map"
			bind:this={svg}
			width={chart.width}
			height={chart.height}
			viewBox="0 0 {chart.width} {chart.height}"
			role="img"
			aria-label="{title}: each variation's lines as a tree, lit where discovered"
			onpointermove={track}
			onpointerleave={() => (hover = null)}
		>
			{#each chart.ruler as tick (tick.x)}
				<text class="ply" x={tick.x} y="16" text-anchor="middle">{tick.label}</text>
			{/each}

			{#each chart.bands as b (b.name)}
				<g class="band" class:here={b.here}>
					<line class="band-line" x1="8" x2={chart.width - 8} y1={b.y - 4} y2={b.y - 4} />
					<text class="band-name" x="12" y={b.y + 13}>
						{b.label}
						{#if zoom === 'overview'}<tspan class="band-count" dx="8">{b.count}</tspan>{/if}
					</text>
					{#if zoom === 'detail'}
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

			<!-- One bead per move, so a line's length can be counted rather than estimated from the ruler. -->
			<g class="beads" style="--bead: {zoom === 'detail' ? 4 : 2.4}px">
				{#each ['fog', 'ember-dim', 'ember', 'lit'] as state (state)}
					{@const d = beads(state)}
					{#if d}<path class="bead {state}" {d} />{/if}
				{/each}
			</g>

			{#if hover}
				<circle class="bead-hover" cx={hover.move.x} cy={hover.move.y} r={zoom === 'detail' ? 5 : 3.5} />
			{/if}

			{#each chart.nodes as node}
				{#if node.line && onplay}
					<g
						class="pick"
						class:asked={asked === node.line}
						role="button"
						tabindex="0"
						aria-label="Play from {node.line.name}"
						onclick={() => pick(node.line!)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								tapped = false;
								pick(node.line!);
							}
						}}
					>
						<circle class="hit" cx={node.x} cy={node.y} r={touch ? 18 : 11} />
						<circle class="node {node.kind}" cx={node.x} cy={node.y} r={node.r} />
					</g>
				{:else}
					<circle class="node {node.kind}" cx={node.x} cy={node.y} r={node.r} />
				{/if}
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

	{#if peek && hover}
		<!-- A diagram beats a move name: you see at once which position the branch under the pointer is. -->
		<div class="peek" style="--x: {hover.x}px; --y: {hover.y}px" aria-hidden="true">
			<span class="peek-board"><MiniBoard fen={peek.epd} orientation={side} /></span>
			<span class="peek-text">
				<b class="num">{moveNumber(peek.ply)}{peek.san}</b>
				<span>{peek.name}</span>
			</span>
		</div>
	{/if}

	{#if asked}
		<div class="ask" role="dialog" aria-label="Play from this line">
			<p>Play from <strong>{asks}</strong>?</p>
			<div class="ask-buttons">
				<button type="button" class="btn small" onclick={() => (asked = null)}>Cancel</button>
				<button type="button" class="btn small go" onclick={() => { const line = asked!; asked = null; onplay?.(line); }}>Play</button>
			</div>
		</div>
	{/if}
</section>

<style>
	.linemap {
		position: relative;
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

	/* The swatches are the nodes they name: a filled dot, a hollow ring, a dotted trail. */
	.legend i {
		display: inline-block;
		width: 9px;
		height: 9px;
		margin-right: 0.4rem;
		vertical-align: -1px;
		border-radius: 50%;
	}

	.legend .lit {
		background: var(--lit);
	}

	.legend .ember {
		border: 1.6px solid var(--ember);
	}

	.legend .fog {
		width: 0.8rem;
		height: 3px;
		vertical-align: middle;
		border-radius: 2px;
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

	/* Zero-length subpaths under a round cap: one path draws every bead of a state. */
	.beads path {
		fill: none;
		stroke-linecap: round;
		stroke-width: var(--bead);
	}

	.bead.lit {
		stroke: var(--lit);
	}

	.bead.ember {
		stroke: var(--ember);
	}

	.bead.ember-dim {
		stroke: var(--ember);
		opacity: 0.45;
	}

	.bead.fog {
		stroke: var(--fog);
	}

	.bead-hover {
		fill: none;
		stroke: var(--text);
		stroke-width: 1.4;
		pointer-events: none;
	}

	.peek {
		position: absolute;
		z-index: 3;
		/* Above and right of the pointer, and never off the left edge of the panel. */
		left: max(0.5rem, calc(var(--x) + 14px));
		top: calc(var(--y) - 0.75rem);
		transform: translateY(-100%);
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface-1);
		box-shadow: 0 14px 30px -12px rgba(0, 0, 0, 0.55);
		pointer-events: none;
	}

	.peek-board {
		display: block;
		width: 104px;
		flex: none;
	}

	.peek-text {
		display: grid;
		gap: 0.15rem;
		max-width: 11rem;
		font-size: 0.78rem;
		line-height: 1.3;
		color: var(--text-2);
	}

	.peek-text b {
		font-size: 0.95rem;
		color: var(--text);
	}

	.band-line {
		stroke: var(--border);
	}

	.band-name {
		font-size: 12.5px;
		font-weight: 500;
		fill: var(--text);
		user-select: none;
	}

	.band.here .band-name {
		fill: var(--ember);
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

	/* An entered line is one route at two brightnesses: the moves played, then the secret continuation.
	   Both are dashed, so the played part reads as the start of that route. Solid belongs to found lines
	   alone — drawn solid, a one-move prefix became a bright bar floating clear of the dashes around it,
	   and read as a stray two-node tree of its own. */
	.edge.ember {
		stroke: var(--ember);
		stroke-width: 1.8;
		stroke-dasharray: 5 3;
	}

	.edge.ember-dim {
		stroke: var(--ember);
		stroke-width: 1.4;
		stroke-dasharray: 3 4;
		opacity: 0.5;
	}

	.edge.lit {
		stroke: var(--lit);
		stroke-width: 2;
	}

	/* A found line's end is a button: the dot is the mark, the invisible disc around it is the target. */
	.pick {
		cursor: pointer;
	}

	.hit {
		fill: transparent;
	}

	.pick:hover .node,
	.pick:focus-visible .node,
	.pick.asked .node {
		stroke: var(--text);
		stroke-width: 2;
	}

	.pick:focus-visible {
		outline: none;
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

	/* The mis-tap guard: names the line before it replays anything. */
	.ask {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding: 0.7rem 1rem calc(0.7rem + env(safe-area-inset-bottom));
		border-top: 1px solid var(--border);
		background: var(--surface-2);
	}

	.ask p {
		margin: 0;
		flex: 1 1 12rem;
		font-size: 0.92rem;
		color: var(--text-2);
	}

	.ask strong {
		color: var(--text);
		font-weight: 600;
	}

	.ask-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.ask .go {
		border-color: var(--accent);
		color: var(--accent);
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
