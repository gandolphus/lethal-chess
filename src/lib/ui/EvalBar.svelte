<script lang="ts">
	import { winChance } from '$lib/coach/judge';
	import { appearance } from '$lib/theme/settings.svelte';
	import { formatEval, type Score } from './position';

	// The "who is better" bar. White's share comes from the same winning-chance
	// curve the verdicts use, so the bar and the coaching can never disagree.
	let {
		score,
		side = 'w',
		stale = false
	}: {
		score: Score | null;
		/** The learner's colour sits at the bottom (or the left, when horizontal). */
		side?: 'w' | 'b';
		/** No fresh evaluation for this position: hold the last one, dimmed. */
		stale?: boolean;
	} = $props();

	const white = $derived(score ? 50 + 50 * winChance(score, 'w') : 50);
	const label = $derived(score ? formatEval(score) : '');
	const whiteAhead = $derived(score ? winChance(score, 'w') >= 0 : true);
	const boardStyle = $derived(appearance.themeOption.board);
</script>

<div
	class="evalbar"
	class:flipped={side === 'b'}
	class:stale
	data-board={boardStyle}
	role="img"
	aria-label={score ? `Evaluation ${label}` : 'No evaluation'}
	style:--white="{white}%"
>
	<div class="black"></div>
	<div class="white"></div>
	<span class="mid" aria-hidden="true"></span>
	{#if label}
		<span class="label num" class:on-white={whiteAhead} class:on-black={!whiteAhead}>{label}</span>
	{/if}
</div>

<style>
	.evalbar {
		--w: var(--white);
		position: relative;
		display: flex;
		flex-direction: column;
		width: 20px;
		border-radius: 4px;
		overflow: hidden;
		background: var(--pb2);
		box-shadow: 0 0 0 1px var(--border);
		font-size: 0.72rem;
		transition: opacity var(--move-ms) var(--ease);
	}

	/* Black on top, White at the bottom: the learner's colour is the near side. */
	.black {
		flex: 1 1 auto;
	}

	.white {
		flex: none;
		height: var(--w);
		background: var(--pw1);
		transition: height 300ms var(--ease);
	}

	.flipped {
		flex-direction: column-reverse;
	}

	.mid {
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		height: 1px;
		background: color-mix(in srgb, var(--accent) 70%, transparent);
	}

	.label {
		position: absolute;
		left: 0;
		right: 0;
		text-align: center;
		font-weight: 700;
		line-height: 20px;
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		padding: 6px 0;
		letter-spacing: 0.03em;
	}

	/* The label sits inside the leading side's share, so it always has a background. */
	.label.on-white {
		bottom: 0;
		color: var(--pb2);
	}

	.label.on-black {
		top: 0;
		color: var(--pw1);
	}

	.flipped .label.on-white {
		bottom: auto;
		top: 0;
	}

	.flipped .label.on-black {
		top: auto;
		bottom: 0;
	}

	.stale {
		opacity: 0.45;
	}

	/* ── per direction ── */
	[data-board='material'] {
		border-radius: 3px;
		box-shadow:
			inset 0 2px 4px rgba(0, 0, 0, 0.45),
			0 0 0 1px var(--frame-edge);
	}

	[data-board='material'] .white {
		box-shadow: inset 0 -1px 0 var(--tile-lo);
	}

	[data-board='instrument'] {
		border-radius: 0;
		box-shadow: 0 0 0 1px var(--grid);
		background-image: repeating-linear-gradient(to bottom, transparent 0 calc(12.5% - 1px), var(--grid) calc(12.5% - 1px) 12.5%);
	}

	[data-board='instrument'] .mid {
		background: var(--signal);
	}

	[data-board='nocturne'] {
		border-radius: 3px;
		box-shadow: 0 0 0 1px var(--border);
		background: var(--surface-2);
	}

	[data-board='nocturne'] .white {
		background: linear-gradient(to top, var(--pw1), var(--accent) 140%);
		box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 55%, transparent);
	}

	/* ── horizontal above the board on narrow screens ── */
	@media (max-width: 860px) {
		.evalbar {
			flex-direction: row;
			width: 100%;
			height: 12px;
		}

		.evalbar.flipped {
			flex-direction: row-reverse;
		}

		.evalbar .white {
			height: auto;
			width: var(--w);
			transition: width 300ms var(--ease);
		}

		.evalbar .mid {
			top: 0;
			bottom: 0;
			left: 50%;
			right: auto;
			width: 1px;
			height: auto;
		}

		.evalbar .label {
			writing-mode: horizontal-tb;
			transform: none;
			top: 0;
			bottom: 0;
			right: auto;
			padding: 0 6px;
			line-height: 12px;
		}

		.evalbar .label.on-white {
			left: 0;
		}

		.evalbar .label.on-black {
			left: auto;
			right: 0;
		}

		.evalbar.flipped .label.on-white {
			left: auto;
			right: 0;
		}

		.evalbar.flipped .label.on-black {
			right: auto;
			left: 0;
		}

		[data-board='instrument'] {
			background-image: repeating-linear-gradient(to right, transparent 0 calc(12.5% - 1px), var(--grid) calc(12.5% - 1px) 12.5%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.white,
		.evalbar {
			transition: none;
		}
	}
</style>
