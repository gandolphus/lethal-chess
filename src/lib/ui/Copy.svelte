<script lang="ts">
	// Notation nobody wants to select by hand. The value never needs to be on screen for this to work,
	// which is the point: a FEN is worth having and not worth reading.
	let { value, label = 'Copy' }: { value: string; label?: string } = $props();

	let done = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
		} catch {
			// No clipboard permission, or an insecure origin: say nothing rather than throw.
			return;
		}
		done = true;
		clearTimeout(timer);
		timer = setTimeout(() => (done = false), 1400);
	}
</script>

<button type="button" class="copy" data-done={done} onclick={copy} aria-label="{label} — copies to the clipboard">
	{done ? 'Copied' : label}
</button>
