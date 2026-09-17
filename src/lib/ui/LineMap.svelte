<script lang="ts">
	import type { IndexedLine, LineStage } from '$lib/explore/book';
	import { tick } from 'svelte';
	import {
		clampScale,
		contentPoint,
		layout,
		openingScale,
		sanOf,
		scaleBounds,
		scrollFor,
		type Here,
		type LayoutMove,
		type Zoom
	} from '$lib/explore/linemap';
	import MiniBoard from '$lib/ui/MiniBoard.svelte';

	let {
		lines,
		stages,
		here = null,
		zoom: initialZoom,
		opening,
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
		title: string;
		/** A variation to scroll to when the map opens. */
		band?: string | null;
		/** Which way up the tooltip's diagram sits. */
		side?: 'w' | 'b';
		onclose?: () => void;
		/** Picks up a line: the map hands back the line and how far of it the learner has earned. */
		onplay?: (line: IndexedLine, resumeTo: number) => void;
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
	let asked = $state.raw<{ line: IndexedLine; resumeTo: number; name: string } | null>(null);

	const chart = $derived(layout(lines, stages, { zoom, width: Math.max(320, width), opening, here, touch }));

	/**
	 * How big the chart is drawn, as a multiple of its laid-out size. The layout itself never changes —
	 * it is computed once for the panel's width, and zooming only scales what is drawn — so the tree keeps
	 * its shape and nothing reflows under the fingers.
	 *
	 * A phone's map is around 1400 × 3700 in a 390 × 600 window: at 1 you see four per cent of it. So on a
	 * phone it opens fitted to the width, which is the whole breadth of the opening and most of its
	 * height, and pinching takes it from "everything at once" to reading the moves. A desktop window
	 * already holds enough to read, so it opens at its natural size and zoom is asked for, not imposed.
	 */
	let scale = $state(1);
	let height = $state(0);
	/** Refitted when a different opening or a different frame arrives — never mid-gesture. */
	let fittedFor = $state('');

	const bounds = $derived(scaleBounds({ width, height }, chart));

	$effect(() => {
		const key = `${title}:${Math.round(width)}x${Math.round(height)}:${Math.round(chart.width)}x${Math.round(chart.height)}`;
		if (!width || !height || key === fittedFor) return;
		fittedFor = key;
		scale = openingScale(bounds, touch);
	});

	/** The chart point currently under a position in the scroller's client box. */
	function chartPointAt(px: number, py: number) {
		if (!scroller) return { x: 0, y: 0 };
		return contentPoint({
			scrollLeft: scroller.scrollLeft,
			scrollTop: scroller.scrollTop,
			px,
			py,
			scale,
			frameWidth: scroller.clientWidth,
			chartWidth: chart.width
		});
	}

	/**
	 * Zooms so that `hold` — a point in chart coordinates — stays under (px, py) in the frame. A pinch
	 * passes the point it grabbed at the start and keeps passing the same one, so a hundred events cannot
	 * drift; a wheel has no gesture to belong to and takes whatever is under the cursor now.
	 */
	async function zoomTo(next: number, px: number, py: number, hold?: { x: number; y: number }) {
		if (!scroller) return;
		const to = clampScale(next, bounds);
		const anchor = hold ?? chartPointAt(px, py);
		if (to !== scale) {
			scale = to;
			// The chart is not its new size until Svelte has written the attributes.
			await tick();
		}
		if (!scroller) return;
		const at = scrollFor({
			anchor,
			px,
			py,
			scale: to,
			frame: { width: scroller.clientWidth, height: scroller.clientHeight },
			chart
		});
		scroller.scrollLeft = at.left;
		scroller.scrollTop = at.top;
	}

	/** Live pointers, so two of them can be told apart and measured against each other. */
	const touches = new Map<number, { x: number; y: number }>();
	/** `hold` is the chart point the fingers grabbed; it is what the whole gesture is measured against. */
	let pinch: { distance: number; scale: number; hold: { x: number; y: number } } | null = null;

	const spread = () => {
		const [a, b] = [...touches.values()];
		return { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
	};

	/**
	 * A click anywhere on the chart plays whatever the pointer is on — every move of a route the learner
	 * has been down, not only its end. `line` is set only where the position was actually reached, so the
	 * ply under the pointer is always one they have earned. Ends carry their own button and handle their
	 * own click; this is for everything else.
	 */
	function onClick(event: MouseEvent) {
		if ((event.target as Element | null)?.closest?.('.pick')) return;
		if (hover?.move.line) pick(hover.move.line, hover.move.ply, hover.move.name);
	}

	/** On a cursor a click plays. On a thumb it asks first, naming the line, so a mis-tap costs nothing. */
	function pick(line: IndexedLine, resumeTo: number, name: string) {
		if (!onplay) return;
		if (tapped) asked = { line, resumeTo, name };
		else onplay(line, resumeTo);
	}

	// The move it would replay *to*, never the line's last move, which may still be secret.
	const asks = $derived(asked ? `${asked.name} — ${sanOf(asked.line)[asked.resumeTo - 1]}` : '');

	/**
	 * The move under the pointer. Matched by proximity rather than by giving every bead its own element:
	 * a big opening has a thousand of them, and a linear scan per pointer move costs nothing.
	 */
	let hover = $state.raw<{ move: LayoutMove; x: number; y: number } | null>(null);
	let svg = $state<SVGSVGElement | null>(null);
	let panel = $state<HTMLElement | null>(null);

	/**
	 * Wheel over the chart. Shift scrolls sideways, as it does everywhere — but when only one axis can
	 * move, every wheel goes that way, because a wheel that does nothing is worse than a convention.
	 */
	function onWheel(event: WheelEvent) {
		if (!scroller) return;
		// A trackpad pinch arrives as a wheel with ctrlKey — this *is* the pinch, on a laptop.
		if (event.ctrlKey || event.metaKey) {
			event.preventDefault();
			const box = scroller.getBoundingClientRect();
			// Exponential, so a trackpad's stream of small deltas is smooth and one mouse notch is a step.
			void zoomTo(scale * Math.exp(-event.deltaY / 400), event.clientX - box.left, event.clientY - box.top);
			return;
		}
		const canX = scroller.scrollWidth - scroller.clientWidth > 1;
		const canY = scroller.scrollHeight - scroller.clientHeight > 1;
		if (!canX && !canY) return;
		// A trackpad's sideways swipe already arrives as deltaX; take whichever axis the gesture meant.
		const amount = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
		if (canX && (!canY || event.shiftKey)) {
			scroller.scrollLeft += amount;
			event.preventDefault();
		} else if (canY && !canX) {
			scroller.scrollTop += amount;
			event.preventDefault();
		}
	}

	/**
	 * Dragging the chart moves it, the way a map is moved — with a finger as well as a cursor. Touch used
	 * to be left to the browser, but a pinch has to be ours (`touch-action: none`), and taking one gesture
	 * means taking both.
	 */
	let panning = $state(false);
	let pan: { x: number; y: number; left: number; top: number; moved: boolean } | null = null;

	function panStart(event: PointerEvent) {
		if (!scroller) return;
		// A fresh gesture: whatever the last one left armed does not apply to this one.
		swallow = false;
		if (event.pointerType === 'touch') {
			touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
			if (touches.size === 2) {
				// A second finger ends the pan it interrupted and starts a pinch from where they are now.
				pan = null;
				panning = false;
				hover = null;
				const { distance, x, y } = spread();
				const box = scroller.getBoundingClientRect();
				pinch = { distance, scale, hold: chartPointAt(x - box.left, y - box.top) };
				return;
			}
			if (touches.size > 2) return;
		} else if (event.button !== 0) return;
		pan = { x: event.clientX, y: event.clientY, left: scroller.scrollLeft, top: scroller.scrollTop, moved: false };
	}

	function panMove(event: PointerEvent) {
		if (event.pointerType === 'touch' && touches.has(event.pointerId)) {
			touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
			if (pinch && touches.size >= 2 && scroller) {
				const { distance, x, y } = spread();
				const box = scroller.getBoundingClientRect();
				// The same held point throughout, against wherever the fingers are now — so the gesture
				// pans as well as zooms, which is what two fingers on a map are expected to do.
				if (pinch.distance > 0) {
					void zoomTo((pinch.scale * distance) / pinch.distance, x - box.left, y - box.top, pinch.hold);
				}
				return;
			}
		}
		if (!pan || !scroller) return;
		const dx = event.clientX - pan.x;
		const dy = event.clientY - pan.y;
		// A few pixels of slack, so a click on a line's end is still a click and not a one-pixel drag.
		if (!pan.moved && Math.hypot(dx, dy) < 4) return;
		if (!pan.moved) {
			pan.moved = true;
			panning = true;
			hover = null;
			scroller.setPointerCapture(event.pointerId);
		}
		scroller.scrollLeft = pan.left - dx;
		scroller.scrollTop = pan.top - dy;
	}

	function panEnd(event: PointerEvent) {
		touches.delete(event.pointerId);
		if (pinch && touches.size < 2) {
			pinch = null;
			swallow = true;
			pan = null;
			panning = false;
			return;
		}
		if (pan?.moved) {
			scroller?.releasePointerCapture?.(event.pointerId);
			swallow = true;
		}
		pan = null;
		panning = false;
	}

	/**
	 * A drag or a pinch is not a tap, so the click it ends with must not play a line. A flag rather than a
	 * one-shot listener, because a gesture does not always end in a click — a pinch usually does not — and
	 * a listener left armed would eat the *next* real tap instead.
	 */
	let swallow = false;

	function swallowClick(event: MouseEvent) {
		if (!swallow) return;
		swallow = false;
		event.stopPropagation();
		event.preventDefault();
	}

	function track(event: PointerEvent) {
		if (pan?.moved || event.pointerType === 'touch' || !svg || !panel) return;
		const box = svg.getBoundingClientRect();
		const frame = panel.getBoundingClientRect();
		const px = ((event.clientX - box.left) / box.width) * chart.width;
		const py = ((event.clientY - box.top) / box.height) * chart.height;
		// Never wider than half a row, so two nodes can never both be the nearest.
		const reach = touch ? 15 : 9;
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
		// At a band's root there is no move into the position; the opening's own last move names it.
		return { epd: line.epds[ply], san: sanOf(line)[ply - 1] ?? sanOf(line)[ply] ?? '', ply, name: hover.move.name };
	});

	/** "12." before a white move, "12…" before a black one. */
	const moveNumber = (ply: number) => (ply % 2 === 1 ? `${(ply + 1) / 2}.` : `${ply / 2}…`);

	/** Every bead of one state on a single path: a zero-length subpath draws a dot under a round cap. */
	const beads = (state: string) =>
		chart.moves
			.filter((m) => m.state === state && m.bead)
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
		// The band's y is in chart units; what scrolls is the drawn chart.
		scroller.scrollTo({ top: Math.max(0, found.y * scale - 12), behavior: smooth ? 'smooth' : 'auto' });
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

	<!-- A scrollable region, and focusable so it can be scrolled from the keyboard as well as dragged.
	     The lint objects to a tabindex on a non-interactive role; a region that scrolls has to be
	     reachable without a mouse (WCAG 2.1.1), which is the stronger rule. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		class="scroll"
		class:hovering={!!hover}
		class:panning
		role="region"
		aria-label="Chart"
		tabindex="0"
		bind:this={scroller}
		bind:clientWidth={width}
		bind:clientHeight={height}
		onwheel={onWheel}
		onclickcapture={swallowClick}
		onpointerdown={panStart}
		onpointermove={panMove}
		onpointerup={panEnd}
		onpointercancel={panEnd}
	>
		<!-- Clicking a move is a pointer-only shorthand layered over the hover preview; the keyboard route
		     to a line is the focusable button on each end node, which handles Enter and Space itself. -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<svg
			class="map"
			bind:this={svg}
			width={chart.width * scale}
			height={chart.height * scale}
			viewBox="0 0 {chart.width} {chart.height}"
			role="img"
			aria-label="{title}: each variation's lines as a tree, lit where discovered"
			onpointermove={track}
			onpointerleave={() => (hover = null)}
			onclick={onClick}
		>
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

			<!-- One bead per move, so a line's length can be counted rather than guessed at. -->
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
						class:hot={hover?.move.x === node.x && hover?.move.y === node.y}
						class:asked={asked?.line === node.line}
						role="button"
						tabindex="0"
						aria-label={node.resumeTo === node.line.moves.length
							? `Play from ${node.name}`
							: `Pick up ${node.name} where you left off`}
						onclick={() => pick(node.line!, node.resumeTo!, node.name)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								tapped = false;
								pick(node.line!, node.resumeTo!, node.name);
							}
						}}
					>
						<circle class="hit" cx={node.x} cy={node.y} r={touch ? 15 : 9} />
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
				<button type="button" class="btn small go" onclick={() => { const it = asked!; asked = null; onplay?.(it.line, it.resumeTo); }}>Play</button>
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
		/* The chart is a map: the background offers to be dragged. */
		cursor: grab;
		/* Panning and pinching are both ours — the browser would otherwise answer a two-finger gesture
		   here by zooming the whole page. */
		touch-action: none;
	}

	/**
	 * Zoomed out past its width the chart is narrower than the frame and sits in the middle of it — by an
	 * auto margin, which resolves to zero once the chart is the wider of the two. Centring it with a flex
	 * container instead splits the overflow to *both* sides, and the half that goes left of the scroll
	 * origin cannot be reached at any scroll position: the map looks cropped exactly as it is zoomed in.
	 */
	.map {
		display: block;
		margin-inline: auto;
	}

	.scroll:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: -2px;
	}

	/* Over something that answers to the pointer, the pointer says so. */
	.scroll.hovering {
		cursor: pointer;
	}

	.scroll.panning {
		cursor: grabbing;
		user-select: none;
	}

	/* While dragging, nothing under the pointer should answer to it. */
	.scroll.panning :global(*) {
		cursor: grabbing;
		pointer-events: none;
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

	/* Solid to the entrance: the moves actually played on this line. */
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

	/* A found line's end is a button: the dot is the mark, the invisible disc around it is the target. */
	.pick {
		cursor: pointer;
	}

	.hit {
		fill: transparent;
	}

	.pick.hot .node,
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
