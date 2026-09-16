// Prism across the four board treatments, several piece sets, both sides, and reduced motion.
// Run: OUT=<shots dir> node prism.mjs           (MOBILE=1 for the phone)
// ONLY=quick takes just the two preview shots for a look during work.
import { api } from './cdp.mjs';

const B = process.env.BASE ?? 'http://localhost:5190';
const quick = process.env.ONLY === 'quick';
const settle = Number(process.env.SETTLE ?? 3000);

const look = async (name, url, extra = {}) => {
	if (extra.reduced) await api.media([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
	await api.goto(url);
	await api.sleep(settle);
	await api.shot(name);
	if (extra.reduced) await api.media([]);
};

if (quick) {
	await look('prism-preview-nebula', `${B}/settings/preview?theme=nebula&pieces=monolith`);
	await look('prism-preview-iris', `${B}/settings/preview?theme=iris&pieces=monolith`);
} else {
	for (const theme of ['nebula', 'iris']) {
		for (const board of ['flat', 'material', 'instrument', 'nocturne']) {
			await look(`prism-${theme}-board-${board}`, `${B}/settings/preview?theme=${theme}&board=${board}&pieces=monolith`);
		}
		for (const pieces of ['chessnut', 'cburnett', 'nocturne', 'regalia']) {
			await look(`prism-${theme}-pieces-${pieces}`, `${B}/settings/preview?theme=${theme}&pieces=${pieces}`);
		}
		await look(`prism-${theme}-reduced-motion`, `${B}/settings/preview?theme=${theme}&pieces=monolith`, { reduced: true });
		await look(`prism-${theme}-settings`, `${B}/settings?theme=${theme}`);
		await look(`prism-${theme}-openings`, `${B}/openings?theme=${theme}`);
	}
}
if (api.logs.some((l) => !l.includes('[vite]'))) console.log(api.logs.filter((l) => !l.includes('[vite]')).join('\n'));
api.close();
