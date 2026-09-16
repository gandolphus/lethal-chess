// Third-party piece sets (see LICENSES.md next to this file). The SVGs are
// kept verbatim; their #fff/#000 palette is rewritten to theme tokens on load
// so they tint like the in-house sets (fill + stroke only — internal highlights
// stay baked in).

const files = import.meta.glob('./{chessnut,cburnett}/[wb][KQRBNP].svg', {
	query: '?raw',
	import: 'default'
}) as Record<string, () => Promise<string>>;

export const IMPORTED_SETS = ['chessnut', 'cburnett'] as const;
export type ImportedSet = (typeof IMPORTED_SETS)[number];

/**
 * A piece is **two colours and no more**: the body it is cut from, and the one line drawn on it. Both
 * sets are black-and-white line art, so every `#000` in the file — fill or stroke — is the body, and
 * every near-white is the line. There is no third value to blend into, which is the point: a black
 * piece whose outline, interior detail and silhouette edge are three different tones reads as a mess,
 * and it only shows up on the pieces that happen to carry detail.
 *
 * Chessnut's line is held short of the highlight because its black pieces have no outline at all — a
 * filled silhouette with the drawing traced just inside the edge — so at full `--pbh` the drawing
 * became the visible outline on very dark squares. Cburnett's heavy outlines are part of its
 * silhouette, so they belong to the body, not to the line.
 */
const PALETTE: Record<ImportedSet, Record<'w' | 'b', { body: string; line: string }>> = {
	chessnut: {
		w: { body: 'var(--pw1)', line: 'var(--pws)' },
		b: { body: 'var(--pb2)', line: 'color-mix(in srgb, var(--pbh) 70%, var(--pb2))' }
	},
	cburnett: {
		w: { body: 'var(--pw1)', line: 'var(--pws)' },
		b: { body: 'var(--pb2)', line: 'var(--pbh)' }
	}
};

const DARK = ['#000', '#000000'];
const LIGHT = ['#ececec', '#f2f2f2', '#fff', '#ffffff'];

/**
 * The file's own palette mapped onto the piece's two colours. On a white piece the roles swap: the
 * near-whites are its body and the blacks are its detail, and `body` doubles as the default fill,
 * since a shape with no `fill` attribute falls back to SVG's black.
 */
function paletteOf(color: 'w' | 'b', set: ImportedSet): { fallback: string; map: Record<string, string> } {
	const { body, line } = PALETTE[set][color];
	const dark = color === 'b' ? body : line;
	const light = color === 'b' ? line : body;
	return {
		fallback: dark,
		map: Object.fromEntries([...DARK.map((hex) => [hex, dark]), ...LIGHT.map((hex) => [hex, light])])
	};
}

function tint(svg: string, color: 'w' | 'b', set: ImportedSet): string {
	const { map } = paletteOf(color, set);
	return svg.replace(/<(path|g|circle|ellipse|rect|polygon|line)\b([^>]*?)(\/?)>/g, (_m, tag, attrs: string, close) => {
		const style: string[] = [];
		attrs = attrs.replace(/\s(fill|stroke)="([^"]*)"/g, (_a, prop: 'fill' | 'stroke', val: string) => {
			style.push(`${prop}:${map[val.toLowerCase()] ?? val}`);
			return '';
		});
		return `<${tag}${attrs}${style.length ? ` style="${style.join(';')}"` : ''}${close}>`;
	});
}

/** The two colours a piece of this set and colour may be painted in. Nothing else is allowed. */
export const paletteFor = (set: ImportedSet, color: 'w' | 'b') => PALETTE[set][color];

export async function importedSprite(set: ImportedSet): Promise<string> {
	let defs = '';
	for (const color of ['w', 'b'] as const) {
		for (const type of ['K', 'Q', 'R', 'B', 'N', 'P']) {
			const raw = await files[`./${set}/${color}${type}.svg`]();
			const viewBox = raw.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 100 100';
			const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
			// Paths with no fill attribute would otherwise fall back to SVG's default black.
			defs += `<symbol id="lp-${set}-${color}${type}" viewBox="${viewBox}"><g style="fill:${paletteOf(color, set).fallback}">${tint(inner, color, set)}</g></symbol>`;
		}
	}
	return `<defs>${defs}</defs>`;
}
