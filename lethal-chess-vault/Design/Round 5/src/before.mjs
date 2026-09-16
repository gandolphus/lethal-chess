// "Before" shots of two existing themes, taken from the untouched stylesheet. Compared pixel-for-pixel
// with the same shots after the scene contract landed. Run: OUT=<shots dir> node before.mjs
import { api } from '/home/ohzo/.claude/jobs/eb2370b5/tmp/cdp.mjs';

const B = process.env.BASE ?? 'http://localhost:5190';
const tag = process.env.TAG ?? 'before';
for (const t of ['obsidian', 'night']) {
	await api.goto(`${B}/settings/preview?theme=${t}&pieces=monolith`);
	await api.shot(`${tag}-preview-${t}`);
}
await api.goto(`${B}/settings?theme=obsidian`);
await api.shot(`${tag}-settings-obsidian`);
await api.goto(`${B}/openings?theme=night`);
await api.shot(`${tag}-openings-night`);
if (api.logs.length) console.log(api.logs.join('\n'));
api.close();
