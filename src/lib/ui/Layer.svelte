<script lang="ts">
	import { tick, type Snippet } from 'svelte';

	/**
	 * The shell a layer is drawn in: a native modal dialog, so the page beneath is inert to the pointer
	 * and the keyboard for as long as it is open, and focus goes back where it was when it closes. On a
	 * desktop it is a drawer down the right, under the control that opened it and clear of the board;
	 * on a phone it is the whole screen, as the line map is.
	 *
	 * Closing is the page's business — the layer is a history entry, and leaving it is a step back — so
	 * every way out ends in `onclose` rather than in `dialog.close()`.
	 */
	let { title, onclose, children }: { title: string; onclose: () => void; children: Snippet } = $props();

	let dialog: HTMLDialogElement;
	let panel: HTMLDivElement;
	let closeButton: HTMLButtonElement;
	let closing = $state(false);

	$effect(() => {
		dialog.showModal();
		closeButton.focus();
	});

	/** Slides out first, then lets go. Under reduced motion there is no animation to wait for. */
	async function close() {
		if (closing) return;
		closing = true;
		await tick();
		await Promise.allSettled(panel.getAnimations().map((animation) => animation.finished));
		onclose();
	}

	/**
	 * The browser may close a modal dialog on its own — a second Escape without user activation is the
	 * documented case — and then the history entry must follow it out. Removal on close is not this:
	 * the element is gone by then.
	 */
	function onClosed() {
		if (closing || !dialog.isConnected) return;
		closing = true;
		onclose();
	}
</script>

<!-- Every key stops here. The page beneath still listens on the window for its shortcuts, and an `n`
     typed into a layer must not restart the drill under it. Escape still reaches the dialog's own
     cancel, which is a default action rather than a listener. A click on the dialog itself is a click
     on the scrim: the panel is a child, so nothing inside it lands here. -->
<dialog
	class="layer"
	class:closing
	data-layer
	bind:this={dialog}
	aria-modal="true"
	aria-labelledby="layer-title"
	oncancel={(event) => {
		event.preventDefault();
		void close();
	}}
	onclose={onClosed}
	onclick={(event) => {
		if (event.target === dialog) void close();
	}}
	onkeydown={(event) => event.stopPropagation()}
>
	<div class="panel" bind:this={panel}>
		<header class="head">
			<h2 id="layer-title">{title}</h2>
			<button type="button" class="btn close" bind:this={closeButton} onclick={close}>
				<span class="cross" aria-hidden="true">✕</span>Close<kbd>Esc</kbd>
			</button>
		</header>
		<div class="body">
			{@render children()}
		</div>
	</div>
</dialog>

<style>
	/* The dialog is the whole viewport and its own scrim: a wash of the page's colour light enough that
	   the page — and the theme change it is about to show — stays readable through it. Its `::backdrop`
	   would do the same, but inherits the theme's tokens only in recent browsers. */
	.layer[open] {
		display: flex;
		justify-content: flex-end;
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		max-width: none;
		max-height: none;
		margin: 0;
		padding: 0;
		border: 0;
		background: color-mix(in srgb, var(--bg) 40%, transparent);
		color: var(--text);
		animation: wash var(--move-ms) var(--ease);
	}

	.layer::backdrop {
		background: transparent;
	}

	.layer.closing {
		animation: wash var(--move-ms) var(--ease) reverse forwards;
	}

	/* Wide enough for three swatches in a row; never the whole width, so the board stays in view. */
	.panel {
		display: flex;
		flex-direction: column;
		width: min(36rem, 100%);
		height: 100%;
		border-left: 1px solid var(--border);
		background: var(--bg);
		box-shadow: -40px 0 80px -40px rgba(0, 0, 0, 0.6);
		animation: from-right var(--move-ms) var(--ease);
	}

	.closing .panel {
		animation: from-right var(--move-ms) var(--ease) reverse forwards;
	}

	/* The same row as the site bar, so the way out sits where the way in was. */
	.head {
		display: flex;
		flex: none;
		align-items: center;
		gap: 1rem;
		height: 3.25rem;
		padding: 0 1.25rem;
		border-bottom: 1px solid var(--border);
	}

	h2 {
		flex: 1;
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 400;
		line-height: 1;
	}

	.close {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.3rem 0.65rem;
		font-size: 0.85rem;
	}

	.cross {
		display: none;
	}

	/* Filling the screen, this is the only way out, so a thumb must not have to aim for it: the cross
	   makes it legible at a glance and the keyboard hint — which no phone can act on — goes. */
	@media (hover: none) and (pointer: coarse) {
		.close {
			min-height: 2.5rem;
			padding-inline: 0.85rem;
			font-size: 0.95rem;
		}

		.close kbd {
			display: none;
		}

		.cross {
			display: inline;
			font-size: 1.05em;
		}
	}

	/* The layer scrolls, and only the layer: reaching its end must not hand the wheel to the page. */
	.body {
		flex: 1;
		min-height: 0;
		padding: 1.25rem 1.25rem 3rem;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	/* A wheel over the scrim would otherwise scroll the page beneath; the root's gutter is stable, so
	   locking it moves nothing. */
	:global(:root:has(dialog[data-layer][open])) {
		overflow: hidden;
	}

	/* A phone screen is the window: the layer takes all of it, rises from the foot, and keeps clear of
	   the notch itself, since fixed positioning escapes the body's safe-area padding. */
	@media (max-width: 860px) {
		.layer[open] {
			padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
			background: var(--bg);
			animation: none;
		}

		.panel {
			width: 100%;
			border-left: 0;
			box-shadow: none;
			animation-name: from-below;
		}

		.closing .panel {
			animation-name: from-below;
		}

		.head {
			padding: 0 0.75rem 0 1rem;
		}
	}

	@keyframes wash {
		from {
			opacity: 0;
		}
	}

	@keyframes from-right {
		from {
			transform: translateX(100%);
		}
	}

	@keyframes from-below {
		from {
			transform: translateY(100%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.layer[open],
		.panel {
			animation: none;
		}
	}
</style>
