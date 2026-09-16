// Which way of writing the sway does the compositor accept? Same measurement as perf.mjs, Nebula only,
// with the sway rewritten by an injected stylesheet each time.
import { api } from './cdp.mjs';

const B = process.env.BASE ?? 'http://localhost:5190';
await api.send('Emulation.setCPUThrottlingRate', { rate: 4 });

const variants = {
	'as written (rotate + translate %)': '',
	'lean only (rotate)': `[data-scene] .piece-slot { animation-name: none !important; animation: lean-x 7s ease-in-out infinite alternate !important; } @keyframes lean-x { from { rotate: -1.6deg } to { rotate: 1.6deg } }`,
	'lean + drift in px': `[data-scene] .piece-slot { animation: lean-x 7s ease-in-out infinite alternate, drift-x 9.6s ease-in-out infinite alternate !important; } @keyframes lean-x { from { rotate: -1.6deg } to { rotate: 1.6deg } } @keyframes drift-x { from { translate: 0 -0.6px } to { translate: 0 0.6px } }`,
	'lean + breathe (rotate + scale)': `[data-scene] .piece-slot { animation: lean-x 7s ease-in-out infinite alternate, breathe-x 9.6s ease-in-out infinite alternate !important; } @keyframes lean-x { from { rotate: -1.6deg } to { rotate: 1.6deg } } @keyframes breathe-x { from { scale: 1 } to { scale: 1.012 } }`,
	'transform shorthand, rotate only': `[data-scene] .piece-slot { animation: tr-x 7s ease-in-out infinite alternate !important; } @keyframes tr-x { from { transform: rotate(-1.6deg) } to { transform: rotate(1.6deg) } }`,
	'no sway': `[data-scene] .piece-slot { animation: none !important; }`
};

const rows = [];
for (const [label, css] of Object.entries(variants)) {
	await api.goto(`${B}/settings/preview?theme=nebula&pieces=monolith`);
	if (css) await api.eval(`document.head.appendChild(Object.assign(document.createElement('style'), { textContent: ${JSON.stringify(css)} })) && true`);
	await api.sleep(2500);
	await api.send('Tracing.start', { traceConfig: { includedCategories: ['disabled-by-default-devtools.timeline', 'devtools.timeline', 'toplevel'], recordMode: 'recordContinuously' }, transferMode: 'ReportEvents' });
	await api.eval(`new Promise((done) => setTimeout(done, 6000))`);
	const events = [];
	const collect = (e) => { const m = JSON.parse(e.data); if (m.method === 'Tracing.dataCollected') events.push(...m.params.value); };
	await new Promise((resolve) => {
		const ws = api.socket();
		ws.addEventListener('message', collect);
		api.send('Tracing.end');
		const onDone = (e) => { const m = JSON.parse(e.data); if (m.method === 'Tracing.tracingComplete') { ws.removeEventListener('message', collect); ws.removeEventListener('message', onDone); resolve(); } };
		ws.addEventListener('message', onDone);
	});
	const names = new Map();
	for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name);
	let main = 0, tick = 0, style = 0;
	const stacks = new Map();
	for (const e of events.filter((e) => e.ph === 'X' && e.dur).sort((a, b) => a.ts - b.ts || b.dur - a.dur)) {
		const key = `${e.pid}:${e.tid}`;
		if (names.get(key) !== 'CrRendererMain') continue;
		const stack = stacks.get(key) ?? [];
		while (stack.length && stack[stack.length - 1] <= e.ts) stack.pop();
		if (!stack.length) main += e.dur / 1000;
		if (e.name === 'AnimationHost::TickAnimations') tick += e.dur / 1000;
		if (e.name === 'UpdateLayoutTree') style += e.dur / 1000;
		stack.push(e.ts + e.dur);
		stacks.set(key, stack);
	}
	rows.push({ variant: label, 'main ms / 6 s': main.toFixed(0), 'main-thread animation ticks ms': tick.toFixed(0), 'style recalc ms': style.toFixed(0) });
}
console.table(rows);
api.close();
