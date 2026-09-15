<script lang="ts">
	import type { Square } from 'chess.js';
	import { PROMOTION_PIECES } from '$lib/chess/pieces';
	import { appearance } from '$lib/theme/settings.svelte';
	import Piece from './Piece.svelte';
	import type { Arrow, SquareMarks } from './board';

	type PieceInfo = { type: string; color: 'w' | 'b' };

	let {
		fen,
		orientation = 'w',
		interactive = true,
		legalTargets = () => [],
		needsPromotion = () => false,
		marks = {},
		arrows = [],
		onMove
	}: {
		fen: string;
		orientation?: 'w' | 'b';
		interactive?: boolean;
		legalTargets?: (square: Square) => Square[];
		needsPromotion?: (from: Square, to: Square) => boolean;
		/** Square → marks to render; the board decides how each mark looks. */
		marks?: SquareMarks;
		arrows?: Arrow[];
		onMove: (from: Square, to: Square, promotion?: string) => void;
	} = $props();

	const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

	let boardEl = $state<HTMLDivElement | null>(null);
	let selected = $state<Square | null>(null);
	let drag = $state<{ from: Square; piece: PieceInfo; x: number; y: number } | null>(null);
	let pendingPromotion = $state<{ from: Square; to: Square } | null>(null);

	const position = $derived(parseFen(fen));
	const sideToMove = $derived(fen.split(' ')[1] === 'b' ? 'b' : 'w');
	const squares = $derived(orderSquares(orientation));
	const targets = $derived(selected ? legalTargets(selected) : []);
	const promotionColor = $derived(pendingPromotion ? position[pendingPromotion.from]?.color : 'w');

	// The theme's structural board treatment. Everything else the board draws comes from tokens.
	const boardStyle = $derived(appearance.themeOption.board);

	// Any position change from outside (engine reply, undo, new game, a drill
	// jumping positions) invalidates selection state tied to the old position.
	$effect(() => {
		void fen;
		selected = null;
		drag = null;
		pendingPromotion = null;
	});

	function parseFen(input: string): Record<string, PieceInfo> {
		const map: Record<string, PieceInfo> = {};
		const rows = input.split(' ')[0].split('/');
		rows.forEach((row, rowIndex) => {
			let file = 0;
			for (const char of row) {
				if (/\d/.test(char)) {
					file += Number(char);
					continue;
				}
				map[`${FILES[file]}${8 - rowIndex}`] = {
					type: char.toLowerCase(),
					color: char === char.toUpperCase() ? 'w' : 'b'
				};
				file++;
			}
		});
		return map;
	}

	function orderSquares(side: 'w' | 'b'): Square[] {
		const files = side === 'w' ? FILES : [...FILES].reverse();
		const ranks = side === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
		const out: Square[] = [];
		for (const rank of ranks) for (const file of files) out.push(`${file}${rank}` as Square);
		return out;
	}

	const isLight = (square: string) =>
		(FILES.indexOf(square[0]) + Number(square[1])) % 2 === 0;

	const uid = $props.id();

	/** Centre of a square in board units (0–800), respecting orientation. */
	function squareCenter(square: Square) {
		const index = squares.indexOf(square);
		return { x: (index % 8) * 100 + 50, y: Math.floor(index / 8) * 100 + 50 };
	}

	/**
	 * One shape per arrow, no markers. The shaft starts outside the origin piece
	 * and stops short of the target centre so the head lands on the square.
	 * Instrument draws a hairline with an open head and a start tick instead.
	 */
	function arrowShape(arrow: Arrow): { points?: string; d?: string } | null {
		const from = squareCenter(arrow.from);
		const to = squareCenter(arrow.to);
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		const len = Math.hypot(dx, dy);
		if (!len) return null;
		const ux = dx / len;
		const uy = dy / len;
		const px = -uy;
		const py = ux;
		const pt = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`;

		if (boardStyle === 'instrument') {
			const start = 30, end = 8, head = 20, hw = 11;
			const sx = from.x + ux * start, sy = from.y + uy * start;
			const ex = to.x - ux * end, ey = to.y - uy * end;
			const bx = ex - ux * head, by = ey - uy * head;
			return {
				d: `M${pt(sx, sy)} L${pt(ex, ey)} M${pt(bx + px * hw, by + py * hw)} L${pt(ex, ey)} L${pt(bx - px * hw, by - py * hw)} M${pt(sx + px * 7, sy + py * 7)} L${pt(sx - px * 7, sy - py * 7)}`
			};
		}

		const nocturne = boardStyle === 'nocturne';
		const w = nocturne ? 7 : 9, head = 30, hw = nocturne ? 20 : 24, start = 26, end = 6;
		const sx = from.x + ux * start, sy = from.y + uy * start;
		const ex = to.x - ux * end, ey = to.y - uy * end;
		const bx = ex - ux * head, by = ey - uy * head;
		return {
			points: [
				pt(sx + px * w, sy + py * w),
				pt(bx + px * w, by + py * w),
				pt(bx + px * hw, by + py * hw),
				pt(ex, ey),
				pt(bx - px * hw, by - py * hw),
				pt(bx - px * w, by - py * w),
				pt(sx - px * w, sy - py * w)
			].join(' ')
		};
	}

	type Label = { text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; light: boolean };

	/** Coordinate labels in board units (0–100), placed per board style; the ruler is Instrument's. */
	const coordLabels = $derived.by((): Label[] => {
		const files = squares.slice(56).map((s) => ({ text: s[0], light: isLight(s) }));
		const ranks = Array.from({ length: 8 }, (_, i) => ({ text: squares[i * 8][1], light: isLight(squares[i * 8]) }));
		const at = (i: number) => i * 12.5;
		switch (boardStyle) {
			case 'material':
				return [
					...files.map((f, i) => ({ ...f, x: at(i) + 6.25, y: 103.6, anchor: 'middle' as const })),
					...ranks.map((r, i) => ({ ...r, x: -2.4, y: at(i) + 7.1, anchor: 'middle' as const }))
				];
			case 'instrument':
				return [
					...files.map((f, i) => ({ ...f, x: at(i) + 6.25, y: 107.2, anchor: 'middle' as const })),
					...ranks.map((r, i) => ({ ...r, x: -6.2, y: at(i) + 7.15, anchor: 'middle' as const }))
				];
			case 'nocturne':
				return [
					...files.map((f, i) => ({ ...f, x: at(i) + 1.1, y: 99, anchor: 'start' as const })),
					...ranks.map((r, i) => ({ ...r, x: 1.1, y: at(i) + 3.1, anchor: 'start' as const }))
				];
			default:
				// Inside the corners, in the opposite square's colour.
				return [
					...files.map((f, i) => ({ ...f, x: at(i) + 11.6, y: 99.2, anchor: 'end' as const })),
					...ranks.map((r, i) => ({ ...r, x: 0.8, y: at(i) + 2.4, anchor: 'start' as const }))
				];
		}
	});

	const RULER_TICKS = Array.from({ length: 17 }, (_, i) => ({ p: i * 6.25, l: i % 2 === 0 ? 2.2 : 1.1 }));

	function squareFromPoint(clientX: number, clientY: number): Square | null {
		if (!boardEl) return null;
		const rect = boardEl.getBoundingClientRect();
		const x = clientX - rect.left;
		const y = clientY - rect.top;
		if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null;
		const col = Math.floor((x / rect.width) * 8);
		const row = Math.floor((y / rect.height) * 8);
		return squares[row * 8 + col] ?? null;
	}

	function commit(from: Square, to: Square) {
		selected = null;
		if (needsPromotion(from, to)) {
			pendingPromotion = { from, to };
			return;
		}
		onMove(from, to);
	}

	function choosePromotion(piece: string) {
		if (!pendingPromotion) return;
		const { from, to } = pendingPromotion;
		pendingPromotion = null;
		onMove(from, to, piece);
	}

	function handlePointerDown(event: PointerEvent) {
		if (event.button === 2) {
			cancelInteraction(event.pointerId);
			return;
		}
		if (!interactive || pendingPromotion || event.button !== 0) return;
		const square = squareFromPoint(event.clientX, event.clientY);
		if (!square) return;

		if (selected && targets.includes(square)) {
			commit(selected, square);
			return;
		}

		const piece = position[square];
		if (!piece || piece.color !== sideToMove) {
			selected = null;
			return;
		}

		selected = square;
		drag = { from: square, piece, x: event.clientX, y: event.clientY };
		boardEl?.setPointerCapture(event.pointerId);
		event.preventDefault();
	}

	/** Drops whatever the learner has in hand: a dragged piece, a selection, a pending promotion. */
	function cancelInteraction(pointerId?: number) {
		if (drag && pointerId !== undefined) boardEl?.releasePointerCapture?.(pointerId);
		drag = null;
		selected = null;
		pendingPromotion = null;
	}

	function handlePointerMove(event: PointerEvent) {
		if (!drag) return;
		// A right-button press while dragging arrives as a chorded pointermove, not a pointerdown.
		if (event.buttons & 2) {
			cancelInteraction(event.pointerId);
			return;
		}
		drag = { ...drag, x: event.clientX, y: event.clientY };
	}

	function handleContextMenu(event: MouseEvent) {
		// Never show the browser menu over the board; right-click means "put it back".
		event.preventDefault();
		cancelInteraction();
	}

	function handlePointerUp(event: PointerEvent) {
		if (!drag) return;
		const from = drag.from;
		const dropped = squareFromPoint(event.clientX, event.clientY);
		drag = null;
		boardEl?.releasePointerCapture?.(event.pointerId);

		// Dropping back on the origin square keeps the piece selected, so a drag
		// that changes its mind degrades into a click-to-move selection.
		if (!dropped || dropped === from) return;
		if (legalTargets(from).includes(dropped)) commit(from, dropped);
		else selected = null;
	}
</script>

<div class="board-wrap" data-board={boardStyle} role="group" aria-label="Board" oncontextmenu={handleContextMenu}>
	<div class="frame">
		<div class="area">
			<!-- TODO: real keyboard/screen-reader support (roving focus over a role="grid")
			     is a follow-up; role="application" only satisfies the lint for now. -->
			<div
				class="board"
				role="application"
				aria-label="Chessboard"
				class:dragging={!!drag}
				bind:this={boardEl}
				onpointerdown={handlePointerDown}
				onpointermove={handlePointerMove}
				onpointerup={handlePointerUp}
				onpointercancel={handlePointerUp}
			>
				{#each squares as square (square)}
					{@const piece = position[square]}
					{@const isTarget = targets.includes(square)}
					{@const squareMarks = marks[square] ?? []}
					<div
						class="square"
						data-square={square}
						class:light={isLight(square)}
						class:selected={selected === square}
						class:last-move={squareMarks.includes('last-move')}
						class:in-check={squareMarks.includes('check')}
						class:hint={squareMarks.includes('hint')}
						class:soft={squareMarks.includes('soft')}
						class:correct={squareMarks.includes('correct')}
						class:wrong={squareMarks.includes('wrong')}
					>
						{#if piece && drag?.from !== square}
							<span class="piece-slot"><Piece type={piece.type} color={piece.color} /></span>
						{/if}

						{#if isTarget}
							<span class="target" class:capture={!!piece}></span>
						{/if}
					</div>
				{/each}
			</div>

			<div class="sheen"></div>

			<svg class="coords" viewBox="0 0 100 100" aria-hidden="true">
				{#if boardStyle === 'instrument'}
					<g class="ruler">
						<path class="bracket" d="M-4.5 -1.5 V-4.5 H-1.5 M101.5 -4.5 H104.5 V-1.5 M104.5 101.5 V104.5 H101.5 M-1.5 104.5 H-4.5 V101.5" />
						{#each RULER_TICKS as tick (tick.p)}
							<line x1={tick.p} y1="101.8" x2={tick.p} y2={101.8 + tick.l} />
							<line x1="-1.8" y1={tick.p} x2={-1.8 - tick.l} y2={tick.p} />
						{/each}
						<line x1="0" y1="101.8" x2="100" y2="101.8" />
						<line x1="-1.8" y1="0" x2="-1.8" y2="100" />
					</g>
				{/if}
				{#each coordLabels as label (label.text)}
					<text x={label.x} y={label.y} text-anchor={label.anchor} class:on-light={label.light}>{label.text}</text>
				{/each}
			</svg>

			{#if arrows.length}
				<svg class="arrows" viewBox="0 0 800 800" aria-hidden="true">
					<defs>
						<filter id="{uid}-beam" x="-20%" y="-20%" width="140%" height="140%">
							<feGaussianBlur in="SourceGraphic" stdDeviation="6" result="g" />
							<feComponentTransfer in="g" result="g2"><feFuncA type="linear" slope=".9" /></feComponentTransfer>
							<feMerge><feMergeNode in="g2" /><feMergeNode in="SourceGraphic" /></feMerge>
						</filter>
					</defs>
					{#each arrows as arrow (`${arrow.from}${arrow.to}${arrow.kind}`)}
						{@const shape = arrowShape(arrow)}
						{#if shape?.points}
							<polygon class="arrow {arrow.kind ?? 'hint'}" points={shape.points} style:filter={boardStyle === 'nocturne' ? `url(#${uid}-beam)` : undefined} />
						{:else if shape?.d}
							<path class="arrow {arrow.kind ?? 'hint'}" d={shape.d} />
						{/if}
					{/each}
				</svg>
			{/if}
		</div>
	</div>

	{#if drag}
		<span class="ghost" style="left:{drag.x}px; top:{drag.y}px">
			<Piece type={drag.piece.type} color={drag.piece.color} lit={false} />
		</span>
	{/if}

	{#if pendingPromotion}
		<div class="promotion">
			<div class="promotion-card">
				<p>Promote to</p>
				<div class="promotion-options">
					{#each PROMOTION_PIECES as piece (piece)}
						<button type="button" onclick={() => choosePromotion(piece)}>
							<span class="promotion-piece"><Piece type={piece} color={promotionColor ?? 'w'} /></span>
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	/* ── structure: wrap (sizing, container) → frame (padding, chrome) → area → grid ── */
	.board-wrap {
		position: relative;
		width: min(78vh, 100%);
		aspect-ratio: 1;
		container-type: inline-size;
		user-select: none;
	}

	.frame {
		position: absolute;
		inset: 0;
		padding: var(--frame-pad);
		border-radius: calc(var(--radius) + var(--frame-pad) * 0.4);
		background: linear-gradient(160deg, var(--frame-a), var(--frame-b));
		box-shadow: var(--board-shadow), 0 0 0 1px var(--frame-edge);
	}

	.area {
		position: relative;
		width: 100%;
		height: 100%;
		border-radius: var(--radius);
		box-shadow: var(--area-shadow);
	}

	.board {
		position: absolute;
		inset: 0;
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		grid-template-rows: repeat(8, 1fr);
		gap: var(--grid-gap);
		padding: var(--grid-gap);
		background: var(--grid-color);
		border-radius: var(--radius);
		overflow: hidden;
		/* Container units resolve against the grid, so rings, dots and glyphs scale with it. */
		container-type: inline-size;
		touch-action: none;
	}

	.board.dragging {
		cursor: grabbing;
	}

	.sheen {
		position: absolute;
		inset: 0;
		border-radius: var(--radius);
		background: var(--sheen);
		pointer-events: none;
	}

	.square {
		position: relative;
		display: grid;
		place-items: center;
		background: var(--sq-dark);
	}

	.square.light {
		background: var(--sq-light);
	}

	/* ── highlights: a translucent fill (::before) that light themes multiply into the wood ── */
	.square::before {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		mix-blend-mode: var(--hl-blend);
	}

	.square.last-move::before {
		background: var(--last);
	}

	.square.hint::before {
		box-shadow: inset 0 0 0 0.34cqi var(--hint);
	}

	.square.selected::before {
		background: var(--sel);
		box-shadow: inset 0 0 0 0.34cqi var(--ring);
	}

	.square.in-check::before {
		background: radial-gradient(circle at 50% 50%, var(--check) 0%, color-mix(in srgb, var(--check) 60%, transparent) 42%, transparent 72%);
		box-shadow: none;
	}

	/* Feedback decays into state: a pass settles into the last-move colour; a fail
	   shakes then dims to a residual; later rules win when a square carries several marks. */
	.square.correct::before {
		background: var(--ok-fill);
		box-shadow: inset 0 0 0 0.34cqi var(--ok);
		animation: settle-ok 1.4s 0.5s ease-out forwards;
	}

	.square.soft::before {
		background: var(--soft-fill);
		box-shadow: inset 0 0 0 0.34cqi var(--soft);
		animation: settle-soft 1.4s 0.5s ease-out forwards;
	}

	.square.wrong::before {
		background: var(--bad-fill);
		box-shadow: inset 0 0 0 0.34cqi var(--bad);
		animation:
			shake 0.32s ease-out,
			settle-bad 1.2s 0.6s ease-out forwards;
	}

	@keyframes settle-ok {
		to {
			background: var(--last);
			box-shadow: inset 0 0 0 0 transparent;
		}
	}
	@keyframes settle-soft {
		to {
			background: color-mix(in srgb, var(--soft) 22%, transparent);
			box-shadow: inset 0 0 0 0.34cqi color-mix(in srgb, var(--soft) 55%, transparent);
		}
	}
	@keyframes settle-bad {
		to {
			background: color-mix(in srgb, var(--bad) 26%, transparent);
			box-shadow: inset 0 0 0 0.34cqi color-mix(in srgb, var(--bad) 60%, transparent);
		}
	}
	@keyframes shake {
		0%,
		100% {
			transform: none;
		}
		25% {
			transform: translateX(-2.5%);
		}
		75% {
			transform: translateX(2.5%);
		}
	}

	/* ── legal-move markers: a dot, or a ring under a capturable piece ── */
	.target {
		position: absolute;
		z-index: 3;
		width: 27%;
		aspect-ratio: 1;
		border-radius: 50%;
		background: var(--dot-on-dark);
		pointer-events: none;
	}

	.square.light > .target {
		background: var(--dot);
	}

	.target.capture {
		width: 92%;
		background: none;
		border: 0.9cqi solid var(--dot-on-dark);
	}

	.square.light > .target.capture {
		border-color: var(--dot);
	}

	/* ── pieces ── */
	.piece-slot {
		position: absolute;
		inset: 3%;
		z-index: 2;
		--piece-size: clamp(1.6rem, 7.2cqi, 4rem);
	}

	.ghost {
		position: fixed;
		z-index: 30;
		width: min(11vh, 6rem);
		height: min(11vh, 6rem);
		transform: translate(-50%, -50%) scale(1.14);
		pointer-events: none;
		--piece-size: min(9vh, 4rem);
		--piece-shadow: drop-shadow(0 14px 12px rgba(0, 0, 0, 0.45));
	}

	/* ── coordinates ── */
	.coords {
		position: absolute;
		inset: 0;
		z-index: 4;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
		font-family: var(--font-num);
		font-size: 1.8px;
		font-weight: 600;
		fill: var(--coord-on-dark);
	}

	.coords text.on-light {
		fill: var(--coord-on-light);
	}

	.ruler {
		display: none;
		stroke: var(--coord);
		fill: none;
	}

	/* ── arrows: one shape each, floating above the board at 90 % ── */
	.arrows {
		position: absolute;
		inset: 0;
		z-index: 5;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}

	.arrow {
		opacity: 0.9;
	}

	.arrow.hint {
		fill: var(--hint);
		stroke: var(--hint);
	}
	.arrow.engine {
		fill: var(--ok);
		stroke: var(--ok);
	}
	.arrow.refutation {
		fill: var(--bad);
		stroke: var(--bad);
	}

	polygon.arrow {
		stroke: none;
	}

	/* ═══ Material: inlaid stone tiles, chamfered frame, engraved coordinates ═══ */
	[data-board='material'] .frame::before {
		content: '';
		position: absolute;
		inset: 6px;
		border-radius: calc(var(--radius) + 6px);
		box-shadow: var(--bevel);
		pointer-events: none;
	}

	[data-board='material'] .square {
		box-shadow:
			inset 0 1px 0 var(--tile-hi),
			inset 1px 0 0 color-mix(in srgb, var(--tile-hi) 60%, transparent),
			inset 0 -1px 0 var(--tile-lo),
			inset -1px 0 0 color-mix(in srgb, var(--tile-lo) 60%, transparent);
	}

	[data-board='material'] .square::before {
		inset: 1px;
	}

	[data-board='material'] .coords {
		font-family: var(--font-ui);
		font-size: 2.1px;
		letter-spacing: 0.04em;
		fill: var(--coord);
	}

	[data-board='material'] .coords text.on-light {
		fill: var(--coord);
	}

	/* ═══ Instrument: hairline grid, ruler, crosshairs, one signal colour ═══ */
	[data-board='instrument'] .square.selected::before {
		box-shadow: inset 0 0 0 0.22cqi var(--ring);
	}

	[data-board='instrument'] .square.last-move::before {
		box-shadow: inset 0 0 0 0.12cqi color-mix(in srgb, var(--ring) 45%, transparent);
	}

	[data-board='instrument'] .square.hint::before {
		box-shadow: inset 0 0 0 0.22cqi var(--hint);
	}

	/* check = signal ring on the square plus a reticle on the piece */
	[data-board='instrument'] .square.in-check::before {
		background: none;
		box-shadow: inset 0 0 0 0.22cqi var(--check);
	}

	[data-board='instrument'] .square.in-check::after {
		content: '';
		position: absolute;
		inset: 18%;
		border: 0.18cqi solid var(--check);
		border-radius: 50%;
		pointer-events: none;
	}

	/* pass = monochrome ring, soft = hatched signal (drafting for "provisional"), fail = solid signal */
	[data-board='instrument'] .square.correct::before {
		box-shadow: inset 0 0 0 0.22cqi var(--ok);
		animation: settle-ok-i 1.4s 0.5s ease-out forwards;
	}

	[data-board='instrument'] .square.soft::before {
		background: repeating-linear-gradient(-45deg, var(--soft-fill) 0 0.55cqi, transparent 0.55cqi 1.6cqi);
		box-shadow: inset 0 0 0 0.22cqi var(--soft);
		animation: settle-soft-i 1.4s 0.5s ease-out forwards;
	}

	[data-board='instrument'] .square.wrong::before {
		box-shadow: inset 0 0 0 0.22cqi var(--bad);
		animation: settle-bad-i 1.2s 0.5s ease-out forwards;
	}

	@keyframes settle-ok-i {
		to {
			background: var(--last);
			box-shadow: inset 0 0 0 0.12cqi color-mix(in srgb, var(--ring) 45%, transparent);
		}
	}
	@keyframes settle-soft-i {
		to {
			box-shadow: inset 0 0 0 0.12cqi color-mix(in srgb, var(--soft) 60%, transparent);
			opacity: 0.7;
		}
	}
	@keyframes settle-bad-i {
		to {
			background: color-mix(in srgb, var(--bad) 22%, transparent);
			box-shadow: inset 0 0 0 0.22cqi var(--bad);
		}
	}

	/* markers are crosshairs, captures are reticles (same on both square colours) */
	[data-board='instrument'] .square > .target {
		width: 22%;
		border-radius: 0;
		background: none;
		background-image: linear-gradient(var(--dot), var(--dot)), linear-gradient(var(--dot), var(--dot));
		background-size:
			100% 1.5px,
			1.5px 100%;
		background-position: center;
		background-repeat: no-repeat;
	}

	[data-board='instrument'] .square > .target.capture {
		width: 78%;
		border: 0.18cqi solid var(--dot);
		border-radius: 50%;
		background-size:
			22% 1.5px,
			1.5px 22%;
	}

	[data-board='instrument'] .arrow {
		fill: none;
		stroke-width: 3.2;
		stroke-linecap: square;
		stroke-linejoin: miter;
		opacity: 1;
	}

	[data-board='instrument'] .coords {
		font-size: 2.5px;
		font-weight: 500;
		fill: var(--coord);
	}

	[data-board='instrument'] .coords text.on-light {
		fill: var(--coord);
	}

	[data-board='instrument'] .ruler {
		display: initial;
	}

	[data-board='instrument'] .ruler line {
		stroke-width: 0.22;
	}

	[data-board='instrument'] .ruler .bracket {
		stroke-width: 0.3;
	}

	/* ═══ Nocturne: light is the feedback medium ═══ */
	[data-board='nocturne'] .board {
		overflow: visible;
	}

	[data-board='nocturne'] .area::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: var(--radius);
		background: var(--vignette);
		pointer-events: none;
	}

	/* Pools spill past their square, so they sit above every square's background
	   (z-index 1) and below every piece (z-index 2) — the prototype raised the whole
	   square instead, which hid the piece on it. */
	[data-board='nocturne'] .square::before {
		inset: -22%;
		z-index: 1;
		border-radius: 50%;
		box-shadow: none;
	}

	[data-board='nocturne'] .square.last-move::before {
		background: radial-gradient(circle, var(--last) 0%, color-mix(in srgb, var(--last) 40%, transparent) 38%, transparent 66%);
	}

	[data-board='nocturne'] .square.selected::before {
		background: radial-gradient(circle, var(--sel) 0%, color-mix(in srgb, var(--sel) 45%, transparent) 36%, transparent 64%);
	}

	[data-board='nocturne'] .square.in-check::before {
		background: radial-gradient(circle, var(--check) 0%, color-mix(in srgb, var(--check) 55%, transparent) 26%, transparent 60%);
	}

	[data-board='nocturne'] .square.hint::before {
		background: none;
	}

	/* rings that keep the state legible under a piece */
	[data-board='nocturne'] .square.selected::after,
	[data-board='nocturne'] .square.hint::after,
	[data-board='nocturne'] .square.correct::after,
	[data-board='nocturne'] .square.soft::after,
	[data-board='nocturne'] .square.wrong::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 1;
		border-radius: 2px;
		pointer-events: none;
	}

	[data-board='nocturne'] .square.selected::after {
		box-shadow: inset 0 0 0 0.2cqi color-mix(in srgb, var(--ring) 70%, transparent);
	}

	[data-board='nocturne'] .square.hint::after {
		box-shadow:
			inset 0 0 0 0.2cqi color-mix(in srgb, var(--hint) 80%, transparent),
			inset 0 0 1.2cqi color-mix(in srgb, var(--hint) 35%, transparent);
	}

	[data-board='nocturne'] .square.correct::after {
		box-shadow: inset 0 0 0 0.18cqi color-mix(in srgb, var(--ok) 55%, transparent);
	}

	[data-board='nocturne'] .square.soft::after {
		box-shadow: inset 0 0 0 0.18cqi color-mix(in srgb, var(--soft) 55%, transparent);
	}

	[data-board='nocturne'] .square.wrong::after {
		box-shadow: inset 0 0 0 0.18cqi color-mix(in srgb, var(--bad) 55%, transparent);
	}

	/* blooms of light that settle into the last-move pool */
	[data-board='nocturne'] .square.correct::before {
		background: radial-gradient(circle, var(--ok-fill) 0%, color-mix(in srgb, var(--ok-fill) 45%, transparent) 36%, transparent 64%);
		animation: bloom-ok 1.8s ease-out forwards;
	}

	[data-board='nocturne'] .square.soft::before {
		background: radial-gradient(circle, var(--soft-fill) 0%, color-mix(in srgb, var(--soft-fill) 45%, transparent) 36%, transparent 64%);
		animation: bloom-soft 1.8s ease-out forwards;
	}

	[data-board='nocturne'] .square.wrong::before {
		background: radial-gradient(circle, var(--bad-fill) 0%, color-mix(in srgb, var(--bad-fill) 45%, transparent) 36%, transparent 64%);
		animation: bloom-bad 1.6s ease-out forwards;
	}

	@keyframes bloom-ok {
		0% {
			transform: scale(0.4);
			opacity: 0;
		}
		18% {
			transform: scale(1.2);
			opacity: 1;
		}
		45% {
			transform: scale(1);
			opacity: 1;
		}
		100% {
			transform: scale(1);
			opacity: 0.85;
			filter: saturate(0.45);
		}
	}
	@keyframes bloom-soft {
		0% {
			transform: scale(0.4);
			opacity: 0;
		}
		18% {
			transform: scale(1.15);
			opacity: 1;
		}
		45% {
			transform: scale(1);
			opacity: 1;
		}
		100% {
			transform: scale(1);
			opacity: 0.85;
		}
	}
	@keyframes bloom-bad {
		0% {
			transform: scale(0.6);
			opacity: 0;
		}
		12% {
			transform: scale(1.25);
			opacity: 1;
		}
		40% {
			transform: scale(1);
			opacity: 1;
		}
		100% {
			transform: scale(0.96);
			opacity: 0.8;
		}
	}

	/* points of light; captures a glowing ring */
	[data-board='nocturne'] .square > .target {
		width: 14%;
		box-shadow: 0 0 1.4cqi 0.2cqi color-mix(in srgb, var(--dot) 55%, transparent);
	}

	[data-board='nocturne'] .square > .target.capture {
		width: 84%;
		border: 0.5cqi solid var(--dot);
		background: none;
		box-shadow:
			0 0 1.4cqi color-mix(in srgb, var(--dot) 50%, transparent),
			inset 0 0 1.4cqi color-mix(in srgb, var(--dot) 40%, transparent);
	}

	[data-board='nocturne'] .arrow {
		opacity: 0.95;
	}

	[data-board='nocturne'] .coords {
		font-size: 2.4px;
		font-weight: 500;
		fill: var(--coord);
	}

	[data-board='nocturne'] .coords text.on-light {
		fill: var(--coord);
	}

	/* ── promotion picker ── */
	.promotion {
		position: absolute;
		inset: 0;
		z-index: 20;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, var(--bg) 72%, transparent);
	}

	.promotion-card {
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 1rem 1.25rem;
		text-align: center;
	}

	.promotion-card p {
		margin: 0 0 0.6rem;
		font-size: 0.85rem;
		color: var(--text-2);
	}

	.promotion-options {
		display: flex;
		gap: 0.4rem;
	}

	.promotion-options button {
		display: grid;
		place-items: center;
		width: 3.2rem;
		height: 3.2rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--sq-dark);
		cursor: pointer;
	}

	.promotion-options button:hover {
		border-color: var(--accent);
		background: var(--sel);
	}

	.promotion-piece {
		display: block;
		width: 2.6rem;
		height: 2.6rem;
		--piece-size: 2.1rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.square::before,
		.square::after {
			animation: none !important;
		}
	}
</style>
