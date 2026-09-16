// Pages of existing themes, under a tag: TAG=head node pages.mjs (files at HEAD) / TAG=now (this branch).
// The settings page has its ninth card hidden in both states, so the pair differs only if anything else did.
import { api } from './cdp.mjs';

const B = process.env.BASE ?? 'http://localhost:5190';
const tag = process.env.TAG;
const pages = {
	'picker-obsidian': '/?theme=obsidian',
	'play-gallery': '/play?theme=gallery',
	'preview-onyx-material': '/settings/preview?theme=onyx&pieces=material',
	'preview-vellum-instrument': '/settings/preview?theme=vellum&pieces=instrument',
	'preview-dawn-nocturne': '/settings/preview?theme=dawn&pieces=nocturne',
	'settings-amethyst': '/settings?theme=amethyst'
};
for (const [name, path] of Object.entries(pages)) {
	await api.goto(`${B}${path}`);
	if (name.startsWith('settings')) {
		await api.eval(`document.head.appendChild(Object.assign(document.createElement('style'), { textContent: '.theme-option:nth-child(9) { visibility: hidden }' })) && true`);
		await api.sleep(300);
	}
	await api.shot(`${tag}-${name}`);
}
api.close();
