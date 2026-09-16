// What is actually animating on a page, and which elements got their own compositing layer.
import { api } from './cdp.mjs';

const B = process.env.BASE ?? 'http://localhost:5190';
await api.goto(`${B}/settings/preview?theme=${process.env.THEME ?? 'nebula'}&pieces=monolith`);
await api.sleep(1500);
console.log(
	await api.eval(`(() => {
		const anims = document.getAnimations();
		const by = {};
		for (const a of anims) {
			const name = a.animationName ?? a.constructor.name;
			const target = a.effect?.target;
			const key = name + ' on ' + (target?.tagName?.toLowerCase() ?? '?') + (a.effect?.pseudoElement ?? '') + (target?.className?.baseVal ?? target?.className ?? '');
			by[key] = (by[key] ?? 0) + 1;
		}
		return JSON.stringify({ scene: document.documentElement.dataset.scene, total: anims.length, by }, null, 1);
	})()`)
);
api.close();
