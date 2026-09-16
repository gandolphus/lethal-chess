// One shot of a page under a tag: TAG=x PAGE=/settings/preview?theme=obsidian NAME=preview-obsidian node one.mjs
import { api } from './cdp.mjs';

await api.goto(`${process.env.BASE ?? 'http://localhost:5190'}${process.env.PAGE ?? '/settings/preview?theme=obsidian&pieces=monolith'}`);
await api.shot(`${process.env.TAG}-${process.env.NAME ?? 'preview-obsidian'}`);
if (process.env.AT) console.log(await api.eval(`document.elementsFromPoint(${process.env.AT}).map((e) => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ').join('.') : '')).join(' > ')`));
api.close();
