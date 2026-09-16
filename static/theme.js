// Puts the stored theme on <html> before the first paint.
//
// The layout sets these attributes in an effect, which runs after hydration — so every load flashed the
// default palette first. This runs from a blocking <script src> in <head> instead, so the document is
// already dressed when it is first painted. It is a file rather than an inline script because the CSP is
// `default-src 'self'` with hashed scripts, and 'self' covers this without a hash to keep in step.
//
// It mirrors `fromStored`/`fromSearch`/`themeFor` in src/lib/theme/settings.svelte.ts. `theme.test.ts`
// fails if the two tables drift apart.
(function () {
	var FAMILIES = {
		stone: ['obsidian', 'gallery'],
		timber: ['ember', 'paper'],
		tide: ['abyss', 'porcelain'],
		grove: ['moss', 'sage'],
		material: ['onyx', 'alabaster'],
		instrument: ['graphite', 'vellum'],
		nocturne: ['night', 'dawn'],
		fabulous: ['amethyst', 'wisteria']
	};
	var FONTS = ['theme', 'editorial', 'grotesque', 'technical', 'geometric', 'fabulous', 'system'];

	/** The family a palette id belongs to, and which side of it — for records from before families. */
	function familyOf(theme) {
		for (var id in FAMILIES) {
			if (FAMILIES[id][0] === theme) return [id, 'dark'];
			if (FAMILIES[id][1] === theme) return [id, 'light'];
		}
		return null;
	}

	var stored = {};
	try {
		stored = JSON.parse(localStorage.getItem('lethal:appearance') || '{}') || {};
	} catch (error) {
		// No storage, or nothing valid in it: the defaults below stand.
	}

	var search = {};
	try {
		var params = new URLSearchParams(location.search);
		search = { theme: params.get('theme'), mode: params.get('mode'), font: params.get('font') };
	} catch (error) {
		// A malformed query previews nothing.
	}

	var legacy = familyOf(stored.theme);
	var preview = familyOf(search.theme);
	var family = preview ? preview[0] : FAMILIES[stored.family] ? stored.family : legacy ? legacy[0] : 'stone';

	var mode = search.mode === 'dark' || search.mode === 'light' ? search.mode : null;
	if (!mode && preview) mode = preview[1];
	if (!mode && (stored.mode === 'dark' || stored.mode === 'light')) mode = stored.mode;
	if (!mode && legacy) mode = legacy[1];
	if (!mode) {
		// Until a mode is chosen the device decides, exactly as the app does.
		try {
			mode = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
		} catch (error) {
			mode = 'dark';
		}
	}

	var font = FONTS.indexOf(search.font) > 0 ? search.font : FONTS.indexOf(stored.font) > 0 ? stored.font : null;

	var root = document.documentElement;
	root.dataset.theme = FAMILIES[family][mode === 'light' ? 1 : 0];
	root.dataset.mode = mode;
	// "Match the theme" means no attribute, so the theme's own pairing stands.
	if (font) root.dataset.font = font;
	else delete root.dataset.font;
})();
