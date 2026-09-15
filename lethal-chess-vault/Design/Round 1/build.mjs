// Assembles prototype.html from prototype.src.html by inlining the imported
// piece sets (chessnut, cburnett) as <symbol>s with theme-tintable colours.
import { readFileSync, writeFileSync } from 'node:fs';

const D = new URL('.', import.meta.url).pathname;
const SETS = { chessnut: '0 0 800 800', cburnett: '0 0 45 45' };
const PIECES = ['K', 'Q', 'R', 'B', 'N', 'P'];

const tint = (svg, color) => {
	const map =
		color === 'w'
			? { '#fff': 'var(--pw1)', '#000': 'var(--pws)' }
			: { '#000': 'var(--pb1)', '#ececec': 'var(--pbh)', '#f2f2f2': 'var(--pbh)', '#fff': 'var(--pbh)' };
	return svg.replace(/<(path|g|circle|ellipse|rect|polygon|line)\b([^>]*?)(\/?)>/g, (m, tag, attrs, close) => {
		const style = [];
		attrs = attrs.replace(/\s(fill|stroke)="([^"]*)"/g, (_, prop, val) => {
			style.push(`${prop}:${map[val.toLowerCase()] ?? val}`);
			return '';
		});
		return `<${tag}${attrs}${style.length ? ` style="${style.join(';')}"` : ''}${close}>`;
	});
};

let symbols = '';
for (const [set, viewBox] of Object.entries(SETS)) {
	for (const color of ['w', 'b']) {
		for (const p of PIECES) {
			const raw = readFileSync(`${D}pieces/${set}/${color}${p}.svg`, 'utf8');
			const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
			symbols += `<symbol id="${set}-${color}${p}" viewBox="${viewBox}">${tint(inner, color)}</symbol>\n`;
		}
	}
}

const src = readFileSync(`${D}prototype.src.html`, 'utf8');
writeFileSync(`${D}prototype.html`, src.replace('<!--PIECE_SYMBOLS-->', symbols));
console.log('wrote prototype.html', symbols.length, 'bytes of symbols');
