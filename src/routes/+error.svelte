<script lang="ts">
	import { page } from '$app/state';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? 'Not found' : 'Something went wrong'} — Lethal Chess</title>
</svelte:head>

<main>
	<p class="code num">{page.status}</p>
	<h1>{notFound ? "That page doesn't exist." : 'Something went wrong.'}</h1>
	<p class="lede">
		{#if notFound}
			The link may be old, or the opening may have a different name now.
		{:else}
			It's not you. Try again in a moment — your progress is safe.
		{/if}
	</p>
	<a class="btn" href="/">Back to the openings</a>
</main>

<style>
	main {
		max-width: 560px;
		margin: 0 auto;
		padding: 5rem 1.25rem;
		text-align: center;
	}

	.code {
		margin: 0;
		font-size: 0.85rem;
		letter-spacing: 0.15em;
		color: var(--text-3);
	}

	h1 {
		margin: 0.4rem 0 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(1.8rem, 5vw, 2.6rem);
	}

	.lede {
		margin: 0.8rem 0 1.8rem;
		color: var(--text-2);
	}

	.btn {
		text-decoration: none;
	}
</style>
