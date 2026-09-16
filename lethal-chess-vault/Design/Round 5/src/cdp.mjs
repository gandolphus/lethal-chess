// Minimal Chrome DevTools Protocol driver: launch headless Chromium, run a scenario, save screenshots.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROMIUM = '/nix/store/f3sl5bk5yrga37qrrqyycv66zgblkr04-chromium-149.0.7827.102/bin/chromium';
const OUT = process.env.OUT ?? '/tmp/lc-shots';
const port = 9300 + Math.floor(Math.random() * 500);

const proc = spawn(CHROMIUM, [
	'--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--no-default-browser-check',
	`--user-data-dir=/tmp/lc-chrome-profile-${port}`, '--window-size=1400,1000', 'about:blank'
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
await send('Emulation.setDeviceMetricsOverride', process.env.MOBILE ? { width: 390, height: 844, deviceScaleFactor: 2, mobile: true } : { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
if (process.env.MOBILE) {
	// Device metrics alone leave hover/pointer as a desktop's; CSS that keys off a coarse pointer needs these.
	await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
	await send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
	await send('Emulation.setEmulatedMedia', { features: [{ name: 'hover', value: 'none' }, { name: 'pointer', value: 'coarse' }, { name: 'any-hover', value: 'none' }, { name: 'any-pointer', value: 'coarse' }] });
}

export const api = {
	logs,
	sleep,
	send,
	socket: () => ws,
	// Emulated media features, e.g. [{ name: 'prefers-reduced-motion', value: 'reduce' }]; [] clears them.
	async media(features) { await send('Emulation.setEmulatedMedia', { features }); },
	async goto(url) { await send('Page.navigate', { url }); await sleep(2500); },
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
	async clipShot(name, clip) { const r = await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: clip.scale ?? 3 } }); writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64')); },
	async wheel(x, y, dx, dy, shift) {
		await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: dx, deltaY: dy, modifiers: shift ? 8 : 0 });
	},
	async drag(x1, y1, x2, y2) {
		await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x1, y: y1, button: 'left', clickCount: 1, buttons: 1 });
		for (let i = 1; i <= 8; i++) {
			await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x1 + ((x2 - x1) * i) / 8, y: y1 + ((y2 - y1) * i) / 8, button: 'left', buttons: 1 });
			await sleep(20);
		}
		await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x2, y: y2, button: 'left', clickCount: 1, buttons: 0 });
	},
	async hover(x, y) {
		await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, pointerType: 'mouse' });
	},
	async clickAt(x, y) {
		await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, buttons: 1 });
		await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, buttons: 0 });
	},
	async key(key) {
		const codes = { ArrowLeft: 37, ArrowRight: 39, ArrowUp: 38, ArrowDown: 40, Enter: 13, Escape: 27, ' ': 32 };
		const printable = key.length === 1;
		const params = { key, windowsVirtualKeyCode: codes[key] ?? (printable ? key.toUpperCase().charCodeAt(0) : 0), nativeVirtualKeyCode: codes[key] ?? (printable ? key.toUpperCase().charCodeAt(0) : 0) };
		if (printable) params.text = key;
		else if (key === 'Enter') params.text = '\r';
		await send('Input.dispatchKeyEvent', { type: printable || key === 'Enter' ? 'keyDown' : 'rawKeyDown', ...params });
		await send('Input.dispatchKeyEvent', { type: 'keyUp', ...params });
	},
	async resize(width, height) { await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: !!process.env.MOBILE }); },
	text: (sel) => api.eval(`document.querySelector(${JSON.stringify(sel)})?.innerText ?? null`),
	close() { ws.close(); proc.kill(); }
};
