<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page, updated } from '$app/state';
	import { appearance } from '$lib/theme/settings.svelte';
	import { progressStore } from '$lib/drill/account.svelte';
	import { loadOpeningIndex } from '$lib/drill/openings';
	import { SyncedProgressStore } from '$lib/drill/synced-store';

	let { children, data } = $props();

	// Themes are pure CSS token sets keyed off these attributes; nothing else knows a theme exists.
	$effect(() => {
		document.documentElement.dataset.theme = appearance.theme;
		document.documentElement.dataset.mode = appearance.themeOption.mode;
	});

	const user = $derived(
		(data as { user?: { id: string; name: string; email: string; picture?: string } | null } | undefined)?.user ?? null
	);

	/**
	 * Signing out removes this account's local copy of its progress, so the next person on a shared
	 * browser can't read it. Anything still unsent in the outbox is flushed first when possible.
	 */
	async function clearLocalAccountData(event: SubmitEvent) {
		if (!user) return;
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		const store = progressStore(user.id);
		if (store instanceof SyncedProgressStore) {
			await Promise.race([store.flush(), new Promise((resolve) => setTimeout(resolve, 3000))]);
		}
		try {
			for (const key of Object.keys(localStorage)) {
				if (key.startsWith(`lethal:user:${user.id}:`)) localStorage.removeItem(key);
			}
		} catch {
			// Storage unavailable: nothing was stored locally either.
		}
		form.submit();
	}

	// On sign-in, progress made while signed out on this browser moves into the account (once).
	$effect(() => {
		const store = progressStore(user?.id ?? null);
		if (!(store instanceof SyncedProgressStore)) return;
		void loadOpeningIndex(fetch)
			.then((openings) => store.adoptSignedOutProgress(openings.map((o) => o.id)))
			.catch(() => {
				// The index failed to load; adoption is retried on the next page load.
			});
	});

	const links = [
		{ href: '/', label: 'Openings', current: (path: string) => path === '/' || path.startsWith('/openings') },
		{ href: '/play', label: 'Play', current: (path: string) => path.startsWith('/play') },
		{ href: '/settings', label: 'Settings', current: (path: string) => path.startsWith('/settings') }
	];

	// The themes' typefaces (all OFL). Only the faces the active theme uses are downloaded.
	const FONTS =
		'https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Instrument+Serif:ital@0;1&family=Fraunces:ital,wght@0,300..600;1,300..600&family=Figtree:wght@400;500;600&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&family=Jost:wght@300;400;500&display=swap';
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link rel="stylesheet" href={FONTS} />
</svelte:head>

<nav class="site" aria-label="Site">
	<a class="brand" href="/">Lethal<span>chess</span></a>
	<div class="links">
		{#each links as link (link.href)}
			<a href={link.href} aria-current={link.current(page.url.pathname) ? 'page' : undefined}>{link.label}</a>
		{/each}
	</div>
	<div class="account">
		{#if user}
			{#if user.picture}
				<img class="avatar" src={user.picture} alt="" width="26" height="26" referrerpolicy="no-referrer" />
			{/if}
			<span class="who">{user.name}</span>
			<form method="POST" action="/auth/logout" onsubmit={clearLocalAccountData}>
				<button type="submit" class="btn small">Sign out</button>
			</form>
		{:else}
			<a class="btn small" href="/auth/google">Sign in</a>
		{/if}
	</div>
</nav>

{#if updated.current}
	<div class="update-banner" role="status">
		<span>Lethal Chess has been updated.</span>
		<button type="button" class="btn small" onclick={() => location.reload()}>Reload now</button>
	</div>
{/if}

{#if page.url.searchParams.get('signin') === 'cancelled'}
	<div class="update-banner" role="status">
		<span>Sign-in was cancelled — you can keep practising without an account.</span>
		<a class="btn small" href={page.url.pathname}>OK</a>
	</div>
{/if}

{@render children?.()}

<footer class="site-footer">
	<a href="https://github.com/gandolphus/lethal-chess" rel="noopener">Source code</a>
	<span aria-hidden="true">·</span>
	<span>AGPL-3.0</span>
	<span aria-hidden="true">·</span>
	<a href="/privacy">Privacy</a>
	<span aria-hidden="true">·</span>
	<a href="/credits">Credits & licences</a>
</footer>

<style>
	.site {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		padding: 0.55rem 1.25rem;
		border-bottom: 1px solid var(--border);
	}

	.brand {
		font-family: var(--font-display);
		font-size: 1.45rem;
		line-height: 1;
		letter-spacing: -0.01em;
		color: var(--text);
		text-decoration: none;
	}

	.brand span {
		margin-left: 0.3rem;
		font-style: italic;
		color: var(--text-2);
	}

	.links {
		display: flex;
		gap: 0.15rem;
		flex: 1;
	}

	.links a {
		padding: 0.35rem 0.6rem;
		border-radius: 6px;
		color: var(--text-2);
		text-decoration: none;
	}

	.links a:hover {
		color: var(--text);
	}

	.links a[aria-current='page'] {
		color: var(--text);
		background: var(--surface-2);
	}

	.account {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.avatar {
		border-radius: 50%;
		border: 1px solid var(--border);
	}

	.who {
		color: var(--text-2);
		font-size: 0.9rem;
	}

	.small {
		padding: 0.32rem 0.7rem;
		font-size: 0.85rem;
	}

	form {
		margin: 0;
	}

	.update-banner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 0.5rem 1rem;
		padding: 0.5rem 1rem;
		border-bottom: 1px solid var(--border);
		background: color-mix(in srgb, var(--accent) 12%, var(--surface-1));
		font-size: 0.9rem;
	}

	.update-banner .btn {
		text-decoration: none;
	}

	.site-footer {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
		padding: 2rem 1rem 2.5rem;
		font-size: 0.8rem;
		color: var(--text-3);
	}

	.site-footer a {
		color: var(--text-2);
		text-decoration: none;
	}

	.site-footer a:hover {
		color: var(--text);
	}

	@media (max-width: 560px) {
		.site {
			flex-wrap: wrap;
			gap: 0.5rem 0.75rem;
			padding: 0.5rem 0.9rem;
		}

		.links {
			order: 3;
			flex-basis: 100%;
		}

		.links a {
			padding: 0.3rem 0.5rem;
		}

		.who {
			display: none;
		}

		.account {
			margin-left: auto;
		}
	}
</style>
