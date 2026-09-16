// Appearance settings: which theme family, dark or light, which piece set and which typeface. Stored
// per browser (a viewer convenience); nothing about progress lives here.

/** Structural board treatment a theme asks for; the board reads only this and tokens. */
export type BoardStyle = 'flat' | 'material' | 'instrument' | 'nocturne';
export type Mode = 'dark' | 'light';

/**
 * A theme that carries depth and motion: backdrop layers behind the page, a hue veil under the board's
 * marks, pieces that sway. Set as `data-scene` on the root, the board and the swatch; without it none of
 * that is generated, so a calm theme costs nothing. The value names the scene for CSS that wants to know.
 */
export type Scene = 'hyperspace';

/** One concrete palette: a `[data-theme]` block in app.css. */
export type ThemeOption = {
	id: string;
	name: string;
	mode: Mode;
	board: BoardStyle;
	scene?: Scene;
};

/** A look that exists in both modes. What the settings page lists; the active theme is `family[mode]`. */
export type ThemeFamily = {
	id: string;
	name: string;
	board: BoardStyle;
	scene?: Scene;
	dark: string;
	light: string;
};

export type PieceSetOption = {
	id: string;
	name: string;
	publicSafe: boolean;
	/** Attribution shown in the picker for third-party sets (full texts in $lib/theme/pieces/LICENSES.md). */
	credit?: string;
};

/**
 * Ordered quiet to loud. The four flat boards come first because they are the conventional look most
 * people expect and the default lives among them — neutral, then warm, cool and green. Then the three
 * structural boards in increasing departure from a plain board: inlaid tiles, a hairline grid, light as
 * the feedback medium. Fabulous next: the one ornamental theme, made to order. Prism last: the one
 * that moves — the loudest thing in the list, so it closes it.
 */
export const FAMILIES: ThemeFamily[] = [
	{ id: 'stone', name: 'Stone', board: 'flat', dark: 'obsidian', light: 'gallery' },
	{ id: 'timber', name: 'Timber', board: 'flat', dark: 'ember', light: 'paper' },
	{ id: 'tide', name: 'Tide', board: 'flat', dark: 'abyss', light: 'porcelain' },
	{ id: 'grove', name: 'Grove', board: 'flat', dark: 'moss', light: 'sage' },
	{ id: 'material', name: 'Material', board: 'material', dark: 'onyx', light: 'alabaster' },
	{ id: 'instrument', name: 'Instrument', board: 'instrument', dark: 'graphite', light: 'vellum' },
	{ id: 'nocturne', name: 'Nocturne', board: 'nocturne', dark: 'night', light: 'dawn' },
	{ id: 'fabulous', name: 'Fabulous', board: 'material', dark: 'amethyst', light: 'wisteria' },
	{ id: 'prism', name: 'Prism', board: 'flat', scene: 'hyperspace', dark: 'nebula', light: 'iris' }
];

const NAMES: Record<string, string> = {
	obsidian: 'Obsidian',
	gallery: 'Gallery',
	ember: 'Ember',
	paper: 'Paper',
	abyss: 'Abyss',
	porcelain: 'Porcelain',
	moss: 'Moss',
	sage: 'Sage',
	onyx: 'Onyx',
	alabaster: 'Alabaster',
	graphite: 'Graphite',
	vellum: 'Vellum',
	night: 'Night',
	dawn: 'Dawn',
	amethyst: 'Amethyst',
	wisteria: 'Wisteria',
	nebula: 'Nebula',
	iris: 'Iris'
};

/** Every palette, dark before light within each family, in family order. */
export const THEMES: ThemeOption[] = FAMILIES.flatMap((family) =>
	(['dark', 'light'] as const).map((mode) => ({
		id: family[mode],
		name: NAMES[family[mode]],
		mode,
		board: family.board,
		...(family.scene ? { scene: family.scene } : {})
	}))
);

export const PIECE_SETS: PieceSetOption[] = [
	{ id: 'monolith', name: 'Monolith', publicSafe: true },
	{ id: 'chessnut', name: 'Chessnut', publicSafe: true, credit: 'Lichess · Apache-2.0' },
	{ id: 'cburnett', name: 'Cburnett', publicSafe: true, credit: 'Colin M. L. Burnett · GPL-2.0+' },
	{ id: 'material', name: 'Material', publicSafe: true },
	{ id: 'instrument', name: 'Instrument', publicSafe: true },
	{ id: 'nocturne', name: 'Nocturne', publicSafe: true },
	{ id: 'regalia', name: 'Regalia', publicSafe: true },
	{ id: 'glyph', name: 'Glyph', publicSafe: true }
];

export type FontOption = {
	id: string;
	name: string;
	/** What the pairing is for, in a few words. */
	note: string;
};

/**
 * Typefaces, chosen apart from the theme. Each theme still carries a default pairing; "Match the theme"
 * uses it. The families themselves live in `app.css` under `[data-font]`, after the theme blocks so they win.
 */
export const FONTS: FontOption[] = [
	{ id: 'theme', name: 'Match the theme', note: "Each theme's own pairing" },
	{ id: 'editorial', name: 'Editorial', note: 'Instrument Sans with Instrument Serif' },
	{ id: 'grotesque', name: 'Grotesque', note: 'Figtree with Fraunces' },
	{ id: 'technical', name: 'Technical', note: 'Geist, with Geist Mono for numbers' },
	{ id: 'geometric', name: 'Geometric', note: 'Jost throughout' },
	{ id: 'fabulous', name: 'Fabulous', note: 'Jost with Fraunces' },
	{ id: 'system', name: 'System', note: "Your device's own fonts — nothing to download" }
];

/** Sets offered in this build; licensing-restricted sets are filtered out of public builds. */
export const AVAILABLE_PIECE_SETS = PIECE_SETS.filter((set) => set.publicSafe || import.meta.env.DEV);

const KEY = 'lethal:appearance';

export type Stored = { family: string; mode: Mode; pieceSet: string; font: string; motion: Motion };

/** How fast a piece travels to its square, and whether it travels at all. */
export type Motion = 'off' | 'fast' | 'normal' | 'slow';

export const MOTIONS: { id: Motion; name: string; note: string }[] = [
	{ id: 'normal', name: 'Normal', note: 'A move you can follow' },
	{ id: 'fast', name: 'Fast', note: 'Quicker, still visible' },
	{ id: 'slow', name: 'Slow', note: 'Easiest to follow' },
	{ id: 'off', name: 'Off', note: 'Pieces appear on their square' }
];

/** The family a theme id belongs to, and which side of it. */
export function familyOf(themeId: unknown): { family: ThemeFamily; mode: Mode } | null {
	for (const family of FAMILIES) {
		if (family.dark === themeId) return { family, mode: 'dark' };
		if (family.light === themeId) return { family, mode: 'light' };
	}
	return null;
}

export const themeFor = (familyId: string, mode: Mode): ThemeOption => {
	const family = FAMILIES.find((f) => f.id === familyId) ?? FAMILIES[0];
	return THEMES.find((t) => t.id === family[mode]) ?? THEMES[0];
};

const BOARD_STYLES: BoardStyle[] = ['flat', 'material', 'instrument', 'nocturne'];

const validFamily = (id: unknown) => (FAMILIES.some((f) => f.id === id) ? (id as string) : null);
const validMode = (mode: unknown): Mode | null => (mode === 'dark' || mode === 'light' ? mode : null);
const validBoard = (id: unknown): BoardStyle | null => (BOARD_STYLES.includes(id as BoardStyle) ? (id as BoardStyle) : null);
const validSet = (id: unknown) => (AVAILABLE_PIECE_SETS.some((p) => p.id === id) ? (id as string) : null);
const validFont = (id: unknown) => (FONTS.some((f) => f.id === id) ? (id as string) : null);
const validMotion = (id: unknown): Motion | null => (MOTIONS.some((m) => m.id === id) ? (id as Motion) : null);

/**
 * What a stored record means, with any unknown value dropped. A record from before theme families
 * carried a single `theme` id; that names both a family and a mode.
 */
export function fromStored(raw: unknown): Partial<Stored> {
	const parsed = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
	const legacy = familyOf(parsed.theme);
	const out: Partial<Stored> = {};
	const family = validFamily(parsed.family) ?? legacy?.family.id;
	const mode = validMode(parsed.mode) ?? legacy?.mode;
	const pieceSet = validSet(parsed.pieceSet);
	const font = validFont(parsed.font);
	const motion = validMotion(parsed.motion);
	if (family) out.family = family;
	if (mode) out.mode = mode;
	if (pieceSet) out.pieceSet = pieceSet;
	if (font) out.font = font;
	if (motion) out.motion = motion;
	return out;
}

/**
 * `?theme=…&mode=…&pieces=…&font=…` previews a look for design review without touching the stored
 * choice. `theme` names a palette, so it sets the family and the mode; `mode` on its own flips the
 * stored family, and next to `theme` it picks that family's other side. `board` puts another family's
 * board treatment under the palette — never stored, only for judging a scene under all four.
 */
export function fromSearch(search: string): Partial<Stored> & { board?: BoardStyle } {
	const out: Partial<Stored> & { board?: BoardStyle } = {};
	try {
		const params = new URLSearchParams(search);
		const theme = familyOf(params.get('theme'));
		const family = theme?.family.id;
		const mode = validMode(params.get('mode')) ?? theme?.mode;
		const pieceSet = validSet(params.get('pieces'));
		const font = validFont(params.get('font'));
		const board = validBoard(params.get('board'));
		if (family) out.family = family;
		if (mode) out.mode = mode;
		if (pieceSet) out.pieceSet = pieceSet;
		if (font) out.font = font;
		if (board) out.board = board;
	} catch {
		// A malformed query previews nothing.
	}
	return out;
}

function load(): Partial<Stored> {
	try {
		const raw = globalThis.localStorage?.getItem(KEY);
		return fromStored(raw ? JSON.parse(raw) : {});
	} catch {
		return {};
	}
}

/** Until a mode is chosen the device's preference decides; an explicit choice sticks after that. */
function preferredMode(): Mode {
	try {
		return globalThis.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
	} catch {
		return 'dark';
	}
}

class Appearance {
	/** Only what was chosen here or carried over; a mode never chosen is not written, so the device's stays. */
	#stored = load();
	#override = fromSearch(globalThis.location?.search ?? '');
	family = $state(this.#override.family ?? this.#stored.family ?? FAMILIES[0].id);
	mode = $state(this.#override.mode ?? this.#stored.mode ?? preferredMode());
	pieceSet = $state(this.#override.pieceSet ?? this.#stored.pieceSet ?? PIECE_SETS[0].id);
	font = $state(this.#override.font ?? this.#stored.font ?? FONTS[0].id);
	motion = $state<Motion>(this.#stored.motion ?? 'normal');

	readonly themeOption = $derived<ThemeOption>(
		this.#override.board ? { ...themeFor(this.family, this.mode), board: this.#override.board } : themeFor(this.family, this.mode)
	);
	/** The active palette's id — what `[data-theme]` is set to. */
	readonly theme = $derived(this.themeOption.id);
	/** The active theme's scene, if it has one — what `data-scene` is set to. */
	readonly scene = $derived(this.themeOption.scene);

	set(update: Partial<Stored> & { theme?: string }) {
		const theme = familyOf(update.theme);
		const family = validFamily(update.family) ?? theme?.family.id;
		const mode = validMode(update.mode) ?? theme?.mode;
		if (family) this.family = this.#stored.family = family;
		if (mode) this.mode = this.#stored.mode = mode;
		if (validSet(update.pieceSet)) this.pieceSet = this.#stored.pieceSet = update.pieceSet!;
		if (validFont(update.font)) this.font = this.#stored.font = update.font!;
		if (validMotion(update.motion)) this.motion = this.#stored.motion = update.motion!;
		try {
			globalThis.localStorage?.setItem(KEY, JSON.stringify(this.#stored));
		} catch {
			// Private mode or blocked storage: the choice lasts for this visit only.
		}
	}
}

export const appearance = new Appearance();
