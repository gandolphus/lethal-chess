<script lang="ts">
	import Report from './Report.svelte';
	import type { PageProps } from './$types';

	/**
	 * The report as a page: what a cold link, a reload, or a submit without JavaScript lands on. From
	 * inside the app the same form opens as a layer over the page it is about (see `$lib/ui/layer`).
	 */
	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Report a bug — Lethal Chess</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="prose">
	<h1>{form?.sent ? 'Thank you' : 'Report a bug'}</h1>
	<Report from={data.from} signedIn={data.signedIn} name={data.name} {form} />
</main>

<style>
	main {
		width: 100%;
		max-width: 46rem;
		margin: 0 auto;
		padding: 2rem 1.25rem 4rem;
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 2.2rem;
	}
</style>
