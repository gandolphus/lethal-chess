// Two follow-ups to diff.mjs: is a 3-pixel, delta-1 difference in the Obsidian preview rasteriser noise
// (two "after" shots of the same page compared with each other), and does the settings page differ only
// by the card that was added (the ninth card hidden, the rest compared)?
import { copyFileSync } from 'node:fs';
import { api } from './cdp.mjs';

const B = process.env.BASE ?? 'http://localhost:5190';
const OUT = process.env.OUT;

await api.goto(`${B}/settings/preview?theme=obsidian&pieces=monolith`);
await api.shot('again-preview-obsidian');
await api.goto(`${B}/settings?theme=obsidian`);
await api.eval(`document.head.appendChild(Object.assign(document.createElement('style'), { textContent: '.theme-option:nth-child(9) { visibility: hidden }' })) && true`);
await api.sleep(300);
await api.shot('again-settings-obsidian');
// diff.mjs pairs every before-* with a same-named after-*; the two untouched pairs are copied through.
for (const name of ['preview-night', 'openings-night']) copyFileSync(`${OUT}/after-${name}.png`, `${OUT}/again-${name}.png`);
api.close();
