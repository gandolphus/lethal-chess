<svelte:head>
	<title>Credits & licences — Lethal Chess</title>
</svelte:head>

<main class="prose">
	<h1>Credits & licences</h1>
	<p class="lede">
		Lethal Chess is free software under the
		<a href="/licenses/lethal-chess-AGPL-3.0.txt">GNU Affero General Public License v3.0</a>. Its complete source code is at
		<a href="https://github.com/gandolphus/lethal-chess" target="_blank" rel="noopener">github.com/gandolphus/lethal-chess</a>. It builds on the
		work below.
	</p>

	<ul class="credits">
		<li>
			<h2>Stockfish</h2>
			<p>
				The chess engine behind play and coached free play, by the
				<a href="https://github.com/official-stockfish/Stockfish" target="_blank" rel="noopener">Stockfish developers</a>, compiled to
				WebAssembly as <a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noopener">Stockfish.js</a> by Nathan Rugg.
				Distributed here unmodified under the <a href="/licenses/stockfish-GPL-3.0.txt">GNU GPL v3.0</a>; corresponding source
				is available from those two repositories.
			</p>
		</li>
		<li>
			<h2>Lichess opening data</h2>
			<p>
				Opening names from <a href="https://github.com/lichess-org/chess-openings" target="_blank" rel="noopener">lichess-org/chess-openings</a>
				and engine evaluations from the <a href="https://database.lichess.org/" target="_blank" rel="noopener">Lichess evaluation database</a>, both
				released into the public domain (CC0).
			</p>
		</li>
		<li>
			<h2>Cburnett pieces</h2>
			<p>
				By Colin M. L. Burnett, via <a href="https://github.com/lichess-org/lila" target="_blank" rel="noopener">Lichess</a>, under the
				<a href="/licenses/cburnett-GPL-2.0.txt">GNU GPL v2.0 or later</a>. Colours are remapped to the active theme.
			</p>
		</li>
		<li>
			<h2>Chessnut pieces</h2>
			<p>
				Via <a href="https://github.com/lichess-org/lila" target="_blank" rel="noopener">Lichess</a>, under the
				<a href="/licenses/chessnut-Apache-2.0.txt">Apache License 2.0</a>. Colours are remapped to the active theme.
			</p>
		</li>
		<li>
			<h2>chess.js</h2>
			<p>
				Chess rules, by Jeff Hlywa, under the <a href="/licenses/chess.js-BSD-2-Clause.txt">BSD 2-Clause licence</a>.
			</p>
		</li>
		<li>
			<h2>ts-fsrs</h2>
			<p>
				The spaced-repetition scheduler, by Open Spaced Repetition, under the <a href="/licenses/ts-fsrs-MIT.txt">MIT licence</a>.
			</p>
		</li>
		<li>
			<h2>Typefaces</h2>
			<p>
				Instrument Sans, Instrument Serif, Fraunces, Figtree, Geist, Geist Mono and Jost, under the SIL Open Font License, served by
				Google Fonts.
			</p>
		</li>
	</ul>
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
	}

	.credits {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	h2 {
		margin: 1.6rem 0 0.3rem;
		font-size: 1.05rem;
		font-weight: 600;
	}

	p {
		margin: 0;
		color: var(--text-2);
	}

	a {
		color: var(--accent);
	}
</style>
