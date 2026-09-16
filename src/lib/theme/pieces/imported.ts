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

// Body colour is the flat equivalent of the custom sets' gradient bottom, so a
// black piece reads as one dark shape; strokes take the stroke token; the light
// detail lines on black pieces take the highlight token.
/**
 * The edge of a black piece. Chessnut draws much heavier outlines than Cburnett, so on themes whose
 * `--pbs` is a *light* edge (Night, Graphite) its silhouette came out ringed and bright. It keeps more of
 * the body colour, cooled slightly, so the outline reads as shadow rather than a stroke.
 */
const BLACK_EDGE: Record<ImportedSet, string> = {
	chessnut: 'color-mix(in srgb, var(--pb2) 82%, color-mix(in srgb, var(--pbs) 55%, #7d92b6))',
	cburnett: 'color-mix(in srgb, var(--pb2) 66%, var(--pbs))'
};

const TINT: Record<'w' | 'b', { body: string; fill: Record<string, string>; stroke: Record<string, string> }> = {
	w: {
		// `body` stands in for SVG's default fill, which is black. In a white piece, shapes with no
		// fill attribute are its dark details (eyes, bands, slits), so the default must be the dark
		// detail colour — using the light body colour here erased every interior feature.
		body: 'var(--pws)',
		fill: { '#fff': 'var(--pw1)', '#ffffff': 'var(--pw1)', '#000': 'var(--pws)', '#000000': 'var(--pws)' },
		stroke: { '#000': 'var(--pws)', '#000000': 'var(--pws)', '#fff': 'var(--pw1)', '#ffffff': 'var(--pw1)' }
	},
	b: {
		body: 'var(--pb2)',
		fill: { '#000': 'var(--pb2)', '#000000': 'var(--pb2)', '#ececec': 'var(--pbh)', '#f2f2f2': 'var(--pbh)', '#fff': 'var(--pbh)', '#ffffff': 'var(--pbh)' },
		// These sets draw black pieces with heavy black outlines that are part of the silhouette.
		// Instrument and Nocturne themes set --pbs to a *light* edge for their own hairline sets;
		// used here it turned the whole piece white. Keep the outline dark, nudged slightly toward
		// the theme's edge colour so it still separates from very dark squares.
		stroke: {
			'#000': BLACK_EDGE.cburnett,
			'#000000': BLACK_EDGE.cburnett,
			'#ececec': 'var(--pbh)',
			'#f2f2f2': 'var(--pbh)',
			'#fff': 'var(--pbh)',
			'#ffffff': 'var(--pbh)'
		}
	}
};

function tint(svg: string, color: 'w' | 'b', set: ImportedSet): string {
	const { fill } = TINT[color];
	const stroke = color === 'b' ? { ...TINT.b.stroke, '#000': BLACK_EDGE[set], '#000000': BLACK_EDGE[set] } : TINT.w.stroke;
	return svg.replace(/<(path|g|circle|ellipse|rect|polygon|line)\b([^>]*?)(\/?)>/g, (_m, tag, attrs: string, close) => {
		const style: string[] = [];
		attrs = attrs.replace(/\s(fill|stroke)="([^"]*)"/g, (_a, prop: 'fill' | 'stroke', val: string) => {
			const map = prop === 'fill' ? fill : stroke;
			style.push(`${prop}:${map[val.toLowerCase()] ?? val}`);
			return '';
		});
		return `<${tag}${attrs}${style.length ? ` style="${style.join(';')}"` : ''}${close}>`;
	});
}

export async function importedSprite(set: ImportedSet): Promise<string> {
	let defs = '';
	for (const color of ['w', 'b'] as const) {
		for (const type of ['K', 'Q', 'R', 'B', 'N', 'P']) {
			const raw = await files[`./${set}/${color}${type}.svg`]();
			const viewBox = raw.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 100 100';
			const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
			// Paths with no fill attribute would otherwise fall back to SVG's default black.
			defs += `<symbol id="lp-${set}-${color}${type}" viewBox="${viewBox}"><g style="fill:${TINT[color].body}">${tint(inner, color, set)}</g></symbol>`;
		}
	}
	return `<defs>${defs}</defs>`;
}
