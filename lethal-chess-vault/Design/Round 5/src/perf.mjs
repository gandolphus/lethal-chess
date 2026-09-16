// Frame cost of a theme on the busiest board the app draws (the preview page: every mark and arrow).
// Run: MOBILE=1 node perf.mjs — a 390×844 phone, CPU throttled 4× (Lighthouse's mid-range profile).
// PARTS=1 measures Nebula with each part of the scene switched off in turn, to see what each costs.
//
// Two measurements per row, on the same page, over the same window:
//  1. Frames: a requestAnimationFrame loop counts delivered frames and the gaps between them. With
//     compositor-driven animation the main thread should stay asleep and frames should keep arriving
//     at the display rate; dropped frames show up as long gaps.
//  2. Threads: a trace of the same window, summed per thread — how many milliseconds the main thread,
//     the compositor and the GPU process actually spent — and the main thread's busiest event names.
import { api } from './cdp.mjs';

const B = process.env.BASE ?? 'http://localhost:5190';
const WINDOW_MS = Number(process.env.WINDOW ?? 6000);
const THROTTLE = Number(process.env.THROTTLE ?? 4);

await api.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

/**
 * `idle` leaves the page alone for the window (what a learner looking at the board costs); otherwise a
 * requestAnimationFrame loop runs, which makes the main thread produce a frame every 16 ms — the worst
 * case, as during a drag — and lets us count delivered frames.
 */
async function measure(label, url, inject = '', idle = false) {
	await api.goto(url);
	if (inject) await api.eval(`document.head.appendChild(Object.assign(document.createElement('style'), { textContent: ${JSON.stringify(inject)} })) && true`);
	await api.sleep(2500); // fonts, sprite, first settle animations — measure the steady state

	await api.send('Tracing.start', {
		traceConfig: {
			includedCategories: ['disabled-by-default-devtools.timeline', 'devtools.timeline', 'toplevel', 'cc', 'gpu', 'viz', 'blink.animations'],
			recordMode: 'recordContinuously'
		},
		transferMode: 'ReportEvents'
	});
	const frames = idle
		? []
		: JSON.parse(
				await api.eval(`new Promise((done) => {
			const gaps = []; let last = performance.now(); const start = last;
			const tick = (t) => { gaps.push(t - last); last = t; if (t - start < ${WINDOW_MS}) requestAnimationFrame(tick); else done(JSON.stringify(gaps)); };
			requestAnimationFrame(tick);
		})`)
			);
	if (idle) await api.eval(`new Promise((done) => setTimeout(done, ${WINDOW_MS}))`);
	const events = [];
	const collect = (e) => { const m = JSON.parse(e.data); if (m.method === 'Tracing.dataCollected') events.push(...m.params.value); };
	await new Promise((resolve) => {
		const ws = api.socket();
		ws.addEventListener('message', collect);
		api.send('Tracing.end');
		const onDone = (e) => { const m = JSON.parse(e.data); if (m.method === 'Tracing.tracingComplete') { ws.removeEventListener('message', collect); ws.removeEventListener('message', onDone); resolve(); } };
		ws.addEventListener('message', onDone);
	});

	// Thread names from metadata; then, per thread, the top-level complete ('X') events summed, and on
	// the renderer main thread the self time of every event by name.
	const names = new Map();
	for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name);
	const busy = new Map();
	const byName = new Map();
	const stacks = new Map();
	const sorted = events.filter((e) => e.ph === 'X' && e.dur).sort((a, b) => a.ts - b.ts || b.dur - a.dur);
	for (const e of sorted) {
		const key = `${e.pid}:${e.tid}`;
		const stack = stacks.get(key) ?? [];
		while (stack.length && stack[stack.length - 1].end <= e.ts) stack.pop();
		if (!stack.length) busy.set(key, (busy.get(key) ?? 0) + e.dur / 1000);
		if (names.get(key) === 'CrRendererMain') {
			byName.set(e.name, (byName.get(e.name) ?? 0) + e.dur / 1000);
			if (stack.length) byName.set(stack[stack.length - 1].name, byName.get(stack[stack.length - 1].name) - e.dur / 1000);
		}
		stack.push({ end: e.ts + e.dur, name: e.name });
		stacks.set(key, stack);
	}
	const thread = (pattern) => [...busy].filter(([k]) => pattern.test(names.get(k) ?? '')).reduce((s, [, v]) => s + v, 0);
	const top = [...byName].filter(([, v]) => v > 5).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, v]) => `${n} ${v.toFixed(0)}`).join(', ');

	const gaps = frames.slice(1);
	const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
	const sortedGaps = [...gaps].sort((a, b) => a - b);
	const p95 = sortedGaps[Math.floor(sortedGaps.length * 0.95)];
	return {
		label: idle ? `${label}, idle` : `${label}, rAF busy`,
		fps: idle ? '' : (1000 / mean).toFixed(1),
		'p95 ms': idle ? '' : p95.toFixed(1),
		'gaps >25ms': idle ? '' : gaps.filter((g) => g > 25).length,
		'main ms': thread(/CrRendererMain/).toFixed(0),
		'compositor ms': thread(/Compositor$/).toFixed(0),
		'gpu ms': thread(/VizCompositorThread|CrGpuMain/).toFixed(0),
		'main thread, by event (self ms)': top
	};
}

const rows = [];
if (process.env.PARTS) {
	const url = `${B}/settings/preview?theme=nebula&pieces=monolith`;
	const off = {
		sway: `[data-scene] .piece-slot { animation: none !important; }`,
		veil: `.veil { display: none !important; }`,
		backdrop: `:root[data-scene]::before, :root[data-scene]::after, [data-scene] body::before, [data-scene] body::after { display: none !important; }`
	};
	rows.push(await measure('nebula, everything', url));
	for (const [part, css] of Object.entries(off)) rows.push(await measure(`nebula, no ${part}`, url, css));
	rows.push(await measure('nebula, nothing', url, Object.values(off).join('\n')));
} else {
	for (const theme of (process.env.THEMES ?? 'obsidian,night,nebula,iris').split(',')) {
		const url = `${B}/settings/preview?theme=${theme}&pieces=monolith`;
		rows.push(await measure(theme, url, '', true));
		rows.push(await measure(theme, url));
	}
}
console.log(`window ${WINDOW_MS} ms, CPU ×${THROTTLE}${process.env.MOBILE ? ', phone 390×844 @2x' : ', desktop 1400×1000'}`);
console.table(rows);
api.close();
