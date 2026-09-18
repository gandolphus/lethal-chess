<script lang="ts">
	import Settings from './Settings.svelte';

	/**
	 * Settings as a page: what a cold arrival, a reload or a shared link lands on. From inside the app
	 * the same content opens as a layer over the page you are on (see `$lib/ui/layer`).
	 */
	let { data } = $props();
	const user = $derived((data as { user?: { id: string; email: string } | null }).user ?? null);
</script>

<svelte:head>
	<title>Settings — Lethal Chess</title>
</svelte:head>

<main>
	<h1>Settings</h1>
	<Settings {user} />
</main>

<style>
	main {
		/* Pinned here as well as inside: the title's typeface changing height would move everything
		   under it. */
		--font-display: 'Instrument Serif', Georgia, 'Times New Roman', serif;
		max-width: 960px;
		margin: 0 auto;
		padding: 2rem 1.5rem 4rem;
	}

	h1 {
		margin: 0 0 1.5rem;
		font-family: var(--font-display);
		font-weight: 500;
	}
</style>
