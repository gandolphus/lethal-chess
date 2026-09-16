// Re-encodes the Prism matrix shots as JPEG (quality .9) in the browser, since a starfield PNG is ~1 MB
// each and the vault lives in git. The before/after proof shots stay PNG: they are compared pixel for pixel.
// Run: node shrink.mjs <dir>
import { readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { api } from './cdp.mjs';

const dir = process.argv[2];
await api.goto('about:blank');
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : e.name.startsWith('prism-') && e.name.endsWith('.png') ? [`${d}/${e.name}`] : []));
let before = 0, after = 0;
for (const file of walk(dir)) {
	const png = readFileSync(file);
	const jpeg = await api.eval(`(async () => {
		const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = 'data:image/png;base64,${png.toString('base64')}'; });
		const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
		c.getContext('2d').drawImage(img, 0, 0);
		return c.toDataURL('image/jpeg', 0.9).split(',')[1];
	})()`);
	const out = Buffer.from(jpeg, 'base64');
	writeFileSync(file.replace(/\.png$/, '.jpg'), out);
	unlinkSync(file);
	before += png.length;
	after += out.length;
}
console.log(`${(before / 1e6).toFixed(1)} MB of PNG → ${(after / 1e6).toFixed(1)} MB of JPEG`);
api.close();
