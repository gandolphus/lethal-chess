// Minimal Chrome DevTools Protocol driver: launch headless Chromium, run a scenario, save screenshots.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROMIUM = '/nix/store/f3sl5bk5yrga37qrrqyycv66zgblkr04-chromium-149.0.7827.102/bin/chromium';
const OUT = process.env.OUT ?? '/home/ohzo/.claude/jobs/eb2370b5/tmp';
const port = 9300 + Math.floor(Math.random() * 500);

const proc = spawn(CHROMIUM, [
	'--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--no-default-browser-check',
	`--user-data-dir=${OUT}/chrome-profile-${port}`, '--window-size=1400,1000', 'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) {
	try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch {}
	await sleep(200);
}
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
const logs = [];
ws.addEventListener('message', (e) => {
	const msg = JSON.parse(e.data);
	if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
	if (msg.method === 'Runtime.consoleAPICalled') logs.push(`[console.${msg.params.type}] ${msg.params.args.map((a) => a.value ?? a.description).join(' ')}`);
	if (msg.method === 'Runtime.exceptionThrown') logs.push(`[exception] ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`);
});
const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });

export const api = {
	logs,
	sleep,
	async goto(url, wait = 2500) { await send('Page.navigate', { url }); await sleep(wait); },
	async viewport(width, height, mobile = false) { await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile }); if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: false }); },
	async eval(expr) { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description; },
	async shot(name) { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64')); },
	async center(square) { return JSON.parse(await this.eval(`JSON.stringify((() => { const r = document.querySelector('[data-square=${square}]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })())`)); },
	async move(from, to) {
		for (const sq of [from, to]) {
			const { x, y } = await this.center(sq);
			await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 });
			await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 0 });
			await sleep(120);
		}
	},
	async key(key) { await send('Input.dispatchKeyEvent', { type: 'keyDown', key, text: key }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key }); },
	text: (sel) => api.eval(`document.querySelector(${JSON.stringify(sel)})?.innerText ?? null`),
	close() { ws.close(); proc.kill(); }
};
