// Screenshots of the Round 3 prototypes from disk, three themes, desktop and phone.
import { api } from './cdp.mjs';

const dir = 'file:///home/ohzo/projects/lethal-chess/lethal-chess-vault/Design/Round%203';
const themes = (process.env.THEMES ?? 'obsidian,alabaster,amethyst').split(',');
const only = process.env.ONLY;

const views = [
	['line-map', 'board', ''],
	['line-map', 'map-detail', '&view=map'],
	['line-map', 'map-overview', '&view=map&zoom=overview'],
	['board-moments', 'trail', '&ply=13'],
	['board-moments', 'celebrate-mid', '&ply=16', 950],
	['board-moments', 'celebrate-settled', '&ply=16', 2600],
	['board-moments', 'celebrate-reduced', '&ply=16&motion=reduce', 1200],
	['atlas-picker', 'picker', '']
];

for (const theme of themes) {
	for (const [file, label, query, wait] of views) {
		if (only && !file.startsWith(only)) continue;
		for (const [w, h, mobile, tag] of [[1400, 1000, false, 'desktop'], [390, 844, true, 'phone']]) {
			await api.viewport(w, h, mobile);
			await api.goto(`${dir}/${file}.html?theme=${theme}${query}`, wait ?? 2500);
			await api.shot(`proto-${label}-${theme}-${tag}`);
		}
	}
}
console.log('LOGS', api.logs.slice(0, 30).join('\n'));
api.close();
