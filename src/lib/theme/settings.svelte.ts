// Appearance settings: which theme and which piece set. Stored per browser
// (a viewer convenience); nothing about progress lives here.

/** Structural board treatment a theme asks for; the board reads only this and tokens. */
export type BoardStyle = 'flat' | 'material' | 'instrument' | 'nocturne';

export type ThemeOption = {
	id: string;
	name: string;
	mode: 'dark' | 'light';
	collection: string;
	board: BoardStyle;
};
export type PieceSetOption = {
	id: string;
	name: string;
	collection: string;
	publicSafe: boolean;
	/** Attribution shown in the picker for third-party sets (full texts in $lib/theme/pieces/LICENSES.md). */
	credit?: string;
};

const r1 = (id: string, name: string, mode: 'dark' | 'light'): ThemeOption => ({
	id,
	name,
	mode,
	collection: 'Round 1',
	board: 'flat'
});

export const THEMES: ThemeOption[] = [
	r1('obsidian', 'Obsidian', 'dark'),
	r1('ember', 'Ember', 'dark'),
	r1('abyss', 'Abyss', 'dark'),
	r1('moss', 'Moss', 'dark'),
	r1('paper', 'Paper', 'light'),
	r1('gallery', 'Gallery', 'light'),
	r1('porcelain', 'Porcelain', 'light'),
	{ id: 'onyx', name: 'Onyx', mode: 'dark', collection: 'Round 2 · Material', board: 'material' },
	{ id: 'alabaster', name: 'Alabaster', mode: 'light', collection: 'Round 2 · Material', board: 'material' },
	{ id: 'graphite', name: 'Graphite', mode: 'dark', collection: 'Round 2 · Instrument', board: 'instrument' },
	{ id: 'vellum', name: 'Vellum', mode: 'light', collection: 'Round 2 · Instrument', board: 'instrument' },
	{ id: 'night', name: 'Night', mode: 'dark', collection: 'Round 2 · Nocturne', board: 'nocturne' },
	{ id: 'dawn', name: 'Dawn', mode: 'light', collection: 'Round 2 · Nocturne', board: 'nocturne' }
];

export const PIECE_SETS: PieceSetOption[] = [
	{ id: 'monolith', name: 'Monolith', collection: 'Round 1', publicSafe: true },
	{ id: 'chessnut', name: 'Chessnut', collection: 'Round 1', publicSafe: true, credit: 'Lichess · Apache-2.0' },
	{ id: 'cburnett', name: 'Cburnett', collection: 'Round 1', publicSafe: true, credit: 'Colin M. L. Burnett · GPL-2.0+' },
	{ id: 'material', name: 'Material', collection: 'Round 2', publicSafe: true },
	{ id: 'instrument', name: 'Instrument', collection: 'Round 2', publicSafe: true },
	{ id: 'nocturne', name: 'Nocturne', collection: 'Round 2', publicSafe: true },
	{ id: 'glyph', name: 'Glyph', collection: 'Base', publicSafe: true }
];

/** Sets offered in this build; licensing-restricted sets are filtered out of public builds. */
export const AVAILABLE_PIECE_SETS = PIECE_SETS.filter((set) => set.publicSafe || import.meta.env.DEV);

const KEY = 'lethal:appearance';

type Stored = { theme: string; pieceSet: string };

const validTheme = (id: unknown) => (THEMES.some((t) => t.id === id) ? (id as string) : null);
const validSet = (id: unknown) => (AVAILABLE_PIECE_SETS.some((p) => p.id === id) ? (id as string) : null);

function load(): Stored {
	const fallback = { theme: THEMES[0].id, pieceSet: PIECE_SETS[0].id };
	try {
		const raw = globalThis.localStorage?.getItem(KEY);
		const parsed = raw ? (JSON.parse(raw) as Partial<Stored>) : {};
		return {
			theme: validTheme(parsed.theme) ?? fallback.theme,
			pieceSet: validSet(parsed.pieceSet) ?? fallback.pieceSet
		};
	} catch {
		return fallback;
	}
}

/** `?theme=…&pieces=…` previews a look for design review without touching the stored choice. */
function urlOverride(): Partial<Stored> {
	try {
		const params = new URLSearchParams(globalThis.location?.search ?? '');
		return {
			theme: validTheme(params.get('theme')) ?? undefined,
			pieceSet: validSet(params.get('pieces')) ?? undefined
		};
	} catch {
		return {};
	}
}

class Appearance {
	#stored = load();
	#override = urlOverride();
	theme = $state(this.#override.theme ?? this.#stored.theme);
	pieceSet = $state(this.#override.pieceSet ?? this.#stored.pieceSet);

	readonly themeOption = $derived(THEMES.find((t) => t.id === this.theme) ?? THEMES[0]);

	set(update: Partial<Stored>) {
		if (update.theme) this.theme = this.#stored.theme = update.theme;
		if (update.pieceSet) this.pieceSet = this.#stored.pieceSet = update.pieceSet;
		try {
			globalThis.localStorage?.setItem(KEY, JSON.stringify(this.#stored));
		} catch {
			// Private mode or blocked storage: the choice lasts for this visit only.
		}
	}
}

export const appearance = new Appearance();
