// Assembles the Round 3 prototypes: inlines the shared parts and mock data so each HTML file runs from disk.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '');
const OUT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
mkdirSync(OUT, { recursive: true });

const part = (name) => readFileSync(`${HERE}/parts/${name}`, 'utf8');
const data = (name) => readFileSync(`${HERE}/${name}`, 'utf8').trim();
const FONTS = 'https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Instrument+Serif:ital@0;1&family=Fraunces:ital,wght@0,300..600;1,300..600&family=Figtree:wght@400;500;600&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&family=Jost:wght@300;400;500&display=swap';

const sprite = readFileSync(`${HERE}/monolith-sprite.svg`, 'utf8');
const themeSwitch = part('switch.html');

for (const name of ['line-map', 'board-moments', 'atlas-picker']) {
	let html = part(`${name}.html`);
	html = html
		.replace('<!--FONTS-->', `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${FONTS}">`)
		.replace('/*TOKENS*/', part('tokens.css'))
		.replace('/*SHARED*/', part('shared.css'))
		.replace('/*BOARD_CSS*/', part('board.css'))
		.replace('<!--SPRITE-->', `<svg aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">${sprite}</svg>`)
		.replace('<!--SWITCH-->', themeSwitch)
		.replace('/*BOARD_JS*/', part('board.js').replace(/^export /gm, ''))
		.replace('/*LINES_JSON*/', data('ruy-lines.json'))
		.replace('/*OPENINGS_JSON*/', data('openings.json'))
		.replace('/*SCENARIO_JSON*/', data('scenario.json'));
	writeFileSync(`${OUT}/${name}.html`, html);
	console.log(name, (html.length / 1024).toFixed(0), 'KB');
}
