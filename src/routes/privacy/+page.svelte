<svelte:head>
	<title>Privacy — Lethal Chess</title>
</svelte:head>

<main class="prose">
	<h1>Privacy</h1>
	<p class="lede">What Lethal Chess stores, why, where — and how to take it back. Last updated 15 September 2026.</p>

	<section>
		<h2>Who is responsible</h2>
		<p>
			Lethal Chess is an independent, open-source project. Questions or requests about your data:
			<a href="mailto:privacy@lethalchess.com">privacy@lethalchess.com</a>.
		</p>
	</section>

	<section>
		<h2>If you don't sign in</h2>
		<p>
			Your progress and your chosen theme are saved <strong>only in this browser</strong> (local storage). They are never sent
			to our server, and clearing your browser data removes them.
		</p>
	</section>

	<section>
		<h2>If you sign in with Google</h2>
		<p>We store, for your account:</p>
		<ul>
			<li>your Google account ID, email address, name and profile picture link — to recognise you and show who is signed in;</li>
			<li>your drill history — the positions you practised, the move you played, whether it was right, and how long you took;</li>
			<li>the review schedule for each position, so positions return when you're about to forget them;</li>
			<li>a sign-in session: a cookie holding a random token, of which the server keeps only a one-way hash.</li>
		</ul>
		<p>
			When you sign in, progress you made on this browser while signed out is <strong>added to your account</strong>. On a
			shared computer, that may include someone else's signed-out practice. When you sign out, your account's copy is removed
			from the browser.
		</p>
		<p>
			Your profile picture is loaded directly from Google's servers when a page shows it. We don't use your data for anything
			except providing the service, and we don't sell or share it.
		</p>
	</section>

	<section>
		<h2>If you report a bug</h2>
		<p>
			Sending a report from <a href="/report">Report a bug</a> stores what you wrote, together with the page you
			were on, your window size, your browser's name and version, and which build of the site you were using. If
			you are signed in it is linked to your account; if you are not, it keeps whatever contact detail you chose
			to give, and nothing if you gave none. The form lists all of this before you send it.
		</p>
		<p>
			It is kept until the problem is dealt with, and read only by us. Deleting your account unlinks your reports
			from it rather than deleting them, so a fixed bug stays fixed — after that they no longer identify you.
		</p>
	</section>

	<section>
		<h2>Visit statistics</h2>
		<p>
			We count visits with <strong>Cloudflare Web Analytics</strong>: which pages are viewed, the referring website, country
			and device type. It uses <strong>no cookies</strong>, doesn't track you across sites and doesn't identify you. There are
			no ads and no other tracking.
		</p>
	</section>

	<section>
		<h2>Who processes data for us</h2>
		<ul>
			<li>
				<strong>Cloudflare</strong> hosts the site, runs it close to you (which may be outside the EU for visitors elsewhere),
				provides the visit statistics, and stores accounts and progress in a database restricted to the <strong>European
				Union</strong>. Error logs are kept for a few days for debugging; we switched off per-visit request logs.
			</li>
			<li><strong>Google</strong> handles the sign-in step itself, under Google's own privacy policy.</li>
			<li><strong>Google Fonts</strong> serves the site's typefaces, so your browser contacts Google to fetch them.</li>
		</ul>
	</section>

	<section>
		<h2>Why we may do this</h2>
		<p>
			Storing your account and progress is needed to provide the service you signed up for (GDPR Art. 6(1)(b)). Cookieless visit
			statistics and error logs are in our legitimate interest in keeping the site working and understanding its use
			(Art. 6(1)(f)).
		</p>
	</section>

	<section>
		<h2>How long</h2>
		<p>
			Until you delete your account. Deleting removes your data immediately; it disappears from the database's automatic
			backups within 30 days. Sign-in sessions expire after 30 days without use.
		</p>
	</section>

	<section>
		<h2>Your rights</h2>
		<p>
			You can access, correct, download or delete your data, object to processing, or ask us to restrict it. Two of these are
			one click in <a href="/settings">Settings</a>: <strong>Download my data</strong> and <strong>Delete my account</strong>. For
			anything else, email <a href="mailto:privacy@lethalchess.com">privacy@lethalchess.com</a>. You may also complain to your
			data protection authority — in Sweden, <a href="https://www.imy.se/" target="_blank" rel="noopener">IMY</a>.
		</p>
	</section>

	<section>
		<h2>Open source</h2>
		<p>
			Everything described here can be checked in the source code:
			<a href="https://github.com/gandolphus/lethal-chess" target="_blank" rel="noopener">github.com/gandolphus/lethal-chess</a> (AGPL-3.0).
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
