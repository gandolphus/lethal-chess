// Pixel-for-pixel comparison of screenshot pairs, done in the browser (no image library here).
// Run: node diff.mjs <dir> <before-tag> <after-tag>  — compares <tag>-*.png pairs by the rest of the name.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { api } from './cdp.mjs';

const [dir, before, after] = process.argv.slice(2);
const names = readdirSync(dir)
	.filter((f) => f.startsWith(`${before}-`) && f.endsWith('.png'))
	.map((f) => f.slice(before.length + 1))
	.filter((name) => existsSync(`${dir}/${after}-${name}`));

await api.goto('about:blank');
const rows = [];
for (const name of names) {
	const a = readFileSync(`${dir}/${before}-${name}`).toString('base64');
	const b = readFileSync(`${dir}/${after}-${name}`).toString('base64');
	const result = JSON.parse(
		await api.eval(`(async () => {
			const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = 'data:image/png;base64,' + src; });
			const [ia, ib] = await Promise.all([load(${JSON.stringify(a)}), load(${JSON.stringify(b)})]);
			if (ia.width !== ib.width || ia.height !== ib.height) return JSON.stringify({ size: 'differs' });
			const draw = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
			const pa = draw(ia), pb = draw(ib);
			let differing = 0, maxDelta = 0; const where = [];
			for (let i = 0; i < pa.length; i += 4) {
				const d = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]));
				if (d) { differing++; if (d > maxDelta) maxDelta = d; if (where.length < 6) where.push(((i / 4) % ia.width) + ',' + Math.floor(i / 4 / ia.width)); }
			}
			return JSON.stringify({ pixels: pa.length / 4, differing, maxDelta, where: where.join(' ') });
		})()`)
	);
	rows.push({ shot: name.replace(/\.png$/, ''), ...result });
}
console.table(rows);
api.close();
