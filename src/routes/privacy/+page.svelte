<svelte:head>
	<title>Privacy — Lethal Chess</title>
</svelte:head>

<main>
	<h1>Privacy</h1>
	<p class="lede">What Lethal Chess stores, why, where — and how to take it back.</p>

	<section>
		<h2>If you don't sign in</h2>
		<p>
			Your progress is saved <strong>only in this browser</strong> (local storage). It is never sent to our server. Clearing your
			browser data removes it.
		</p>
	</section>

	<section>
		<h2>If you sign in with Google</h2>
		<p>We store, for your account:</p>
		<ul>
			<li>your Google account ID, email address, name and profile picture URL — to recognise you and show who is signed in;</li>
			<li>your drill history — which positions you practised, the move you played, whether it was right, and how long you took;</li>
			<li>the review schedule for each position, so positions come back when you are about to forget them;</li>
			<li>a hashed session identifier, so you stay signed in (the cookie itself holds a random token).</li>
		</ul>
		<p>
			We use this only to provide the service you signed in for. There are no ads, no analytics or tracking scripts, and no
			cookies other than the ones sign-in needs.
		</p>
	</section>

	<section>
		<h2>Where it is stored</h2>
		<p>
			In a Cloudflare D1 database restricted to the <strong>European Union</strong>: stored and processed only in the EU.
			Cloudflare hosts the site and database on our behalf. Google handles the sign-in step itself.
		</p>
		<p>
			The site's typefaces are currently loaded from Google Fonts, which means your browser contacts Google to fetch them.
		</p>
	</section>

	<section>
		<h2>How long</h2>
		<p>Until you delete your account. Sign-in sessions expire after 30 days of inactivity.</p>
	</section>

	<section>
		<h2>Your data, your call</h2>
		<p>
			In <a href="/settings">Settings</a> you can <strong>download everything</strong> stored about you as a file, and
			<strong>delete your account</strong> — which permanently removes your account and all your progress at once.
		</p>
	</section>

	<section>
		<h2>Open source</h2>
		<p>
			Everything described here can be checked in the source code:
			<a href="https://github.com/gandolphus/lethal-chess" rel="noopener">github.com/gandolphus/lethal-chess</a> (AGPL-3.0).
		</p>
	</section>
</main>

<style>
	main {
		max-width: 680px;
		margin: 0 auto;
		padding: 2.5rem 1.25rem 4rem;
		line-height: 1.6;
	}

	h1 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(2rem, 5vw, 2.8rem);
	}

	.lede {
		margin: 0.4rem 0 2rem;
		color: var(--text-2);
		font-size: 1.05rem;
	}

	h2 {
		margin: 1.8rem 0 0.4rem;
		font-size: 1.05rem;
		font-weight: 600;
	}

	p,
	li {
		color: var(--text-2);
	}

	strong {
		color: var(--text);
		font-weight: 600;
	}

	ul {
		padding-left: 1.2rem;
	}

	a {
		color: var(--accent);
	}
</style>
