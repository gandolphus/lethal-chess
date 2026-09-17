<script lang="ts">
	import '../app.css';
	import { page, updated } from '$app/state';
	import { onNavigate } from '$app/navigation';
	import { appearance } from '$lib/theme/settings.svelte';
	import { progressStore } from '$lib/drill/account.svelte';
	import { loadOpeningIndex } from '$lib/drill/openings';
	import { SyncedProgressStore } from '$lib/drill/synced-store';

	let { children, data } = $props();

	// Themes are pure CSS token sets keyed off these attributes; nothing else knows a theme exists.
	$effect(() => {
		document.documentElement.dataset.theme = appearance.theme;
		document.documentElement.dataset.mode = appearance.mode;
		// How fast a piece travels to its square; `app.css` turns this into `--piece-ms`.
		document.documentElement.dataset.motion = appearance.motion;
		// A theme with a scene carries depth and motion behind the page; a calm theme sets no attribute.
		if (appearance.scene) document.documentElement.dataset.scene = appearance.scene;
		else delete document.documentElement.dataset.scene;
		// "Match the theme" means no attribute, so the theme's own pairing stands.
		if (appearance.font === 'theme') delete document.documentElement.dataset.font;
		else document.documentElement.dataset.font = appearance.font;
		// The installed app's status bar and title bar take their colour from here.
		document
			.querySelector('meta[name="theme-color"]')
			?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
	});

	const user = $derived(
		(data as { user?: { id: string; name: string; email: string; picture?: string } | null } | undefined)?.user ?? null
	);

	/**
	 * Signing out removes this account's local copy of its progress, so the next person on a shared
	 * browser can't read it. The outbox is flushed first; whatever still hasn't reached the server stays
	 * queued (and only that) and uploads the next time this account signs in here.
	 */
	async function clearLocalAccountData(event: SubmitEvent) {
		if (!user) return;
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		const store = progressStore(user.id);
		const outbox = `lethal:user:${user.id}:outbox`;
		if (store instanceof SyncedProgressStore) {
			await Promise.race([store.flush(), new Promise((resolve) => setTimeout(resolve, 3000))]);
			const pending = store.pendingCount();
			const message = `${pending} ${pending === 1 ? "change hasn't" : "changes haven't"} reached your account yet. They'll upload the next time you sign in on this browser.\n\nSign out anyway?`;
			if (pending && !confirm(message)) return;
		}
		try {
			for (const key of Object.keys(localStorage)) {
				if (key.startsWith(`lethal:user:${user.id}:`) && key !== outbox) localStorage.removeItem(key);
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

	/**
	 * Moving between screens cross-fades instead of cutting. `startViewTransition` is missing in some
	 * browsers, and the navigation must still happen there, so the whole thing is behind the check.
	 */
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	// `icon` is what the phone shows in place of the label: one row of glyphs instead of two rows of words.
	const links = [
		{ href: '/', label: 'Openings', icon: 'board', current: (path: string) => path === '/' || path.startsWith('/openings') },
		{ href: '/today', label: 'Today', icon: 'calendar', current: (path: string) => path.startsWith('/today') },
		{ href: '/play', label: 'Play', icon: 'play', current: (path: string) => path.startsWith('/play') },
		{ href: '/settings', label: 'Settings', icon: 'sliders', current: (path: string) => path.startsWith('/settings') }
	];

	// The themes' typefaces (all OFL). Only the faces the active theme uses are downloaded.
	const FONTS =
		'https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Instrument+Serif:ital@0;1&family=Fraunces:ital,wght@0,300..600;1,300..600&family=Figtree:wght@400;500;600&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&family=Jost:wght@300;400;500&display=swap';
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link rel="stylesheet" href={FONTS} />
</svelte:head>

<!-- One glyph per destination, drawn with the text colour so a theme needs to know nothing about them. -->
{#snippet glyph(name: string)}
	<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
		{#if name === 'board'}
			<rect x="3.5" y="3.5" width="17" height="17" rx="2" />
			<path d="M12 3.5v17M3.5 12h17" />
		{:else if name === 'calendar'}
			<rect x="3.5" y="5.5" width="17" height="15" rx="2" />
			<path d="M3.5 10.5h17M8.5 3v4M15.5 3v4" />
		{:else if name === 'play'}
			<path d="M8 5.6v12.8L19 12z" fill="currentColor" stroke-linejoin="round" />
		{:else if name === 'sliders'}
			<path d="M4 8h9M17 8h3M4 16h3M11 16h9" />
			<circle cx="15" cy="8" r="2" />
			<circle cx="9" cy="16" r="2" />
		{:else if name === 'shield'}
			<path d="M12 3.2l7 2.8v5c0 4.4-2.9 7.4-7 8.8-4.1-1.4-7-4.4-7-8.8V6z" />
		{/if}
	</svg>
{/snippet}

<nav class="site" aria-label="Site">
	<a class="brand" href="/">Lethal<span>chess</span></a>
	<div class="links">
		{#each links as link (link.href)}
			<a href={link.href} aria-current={link.current(page.url.pathname) ? 'page' : undefined}>
				{@render glyph(link.icon)}<span class="word">{link.label}</span>
			</a>
		{/each}
		{#if (data as { isAdmin?: boolean }).isAdmin}
			<a href="/admin" aria-current={page.url.pathname.startsWith('/admin') ? 'page' : undefined}>
				{@render glyph('shield')}<span class="word">Admin</span>
			</a>
		{/if}
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
	<a href="https://github.com/gandolphus/lethal-chess" target="_blank" rel="noopener">Source code</a>
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
		/* Fixed height: themes change the typeface, and the bar must not resize the page under the reader. */
		height: 3.25rem;
		padding: 0 1.25rem;
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
		display: flex;
		align-items: center;
		padding: 0.35rem 0.6rem;
		border-radius: 6px;
		color: var(--text-2);
		text-decoration: none;
	}

	/* Words above 560px, glyphs below it; neither is ever drawn twice. */
	.icon {
		display: none;
		width: 1.35rem;
		height: 1.35rem;
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
		align-items: center;
		gap: 0.5rem;
		/* At the foot of the window, not hanging off the bottom of the content, and no taller than the
		   nav — a row of small print should never be the reason a screen has to scroll. */
		margin-top: auto;
		min-height: 3.25rem;
		padding: 0.5rem 1rem;
		font-size: 0.8rem;
		color: var(--text-3);
	}

	/* The small print is not phone content, and on a small screen it is the difference between a screen
	   that fits and one that scrolls. Its links live in Settings, reachable either way. This lives here,
	   not in app.css: a scoped `.site-footer.svelte-x { display: flex }` outranks a global `.site-footer`,
	   so the global rule that used to do this for the installed app never actually won. */
	@media (display-mode: standalone), (max-width: 860px) {
		.site-footer {
			display: none;
		}
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
			gap: 0.6rem;
			padding: 0 0.7rem;
		}

		.brand {
			font-size: 1.2rem;
		}

		/* One row: the destinations become glyphs, and their words stay for a screen reader only. */
		.icon {
			display: block;
		}

		.word {
			position: absolute;
			width: 1px;
			height: 1px;
			margin: -1px;
			padding: 0;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}

		.links {
			justify-content: flex-end;
			gap: 0.1rem;
		}

		.links a {
			padding: 0.4rem 0.45rem;
		}

		.who {
			display: none;
		}

		.account {
			margin-left: 0;
		}
	}
</style>
