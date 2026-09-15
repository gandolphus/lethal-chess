// Minimal board: 64 squares with data-square, pieces from the app's Monolith sprite (inlined by the build).
const FILES = 'abcdefgh';
export function squaresFor(orientation = 'w') {
	const out = [];
	for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
		const file = orientation === 'w' ? f : 7 - f;
		const rank = orientation === 'w' ? 7 - r : r;
		out.push(FILES[file] + (rank + 1));
	}
	return out;
}
export function isLight(sq) { return (FILES.indexOf(sq[0]) + Number(sq[1])) % 2 === 1; }
export function fenToMap(fen) {
	const map = {};
	const rows = fen.split(' ')[0].split('/');
	rows.forEach((row, i) => {
		let f = 0;
		for (const ch of row) {
			if (/\d/.test(ch)) { f += Number(ch); continue; }
			map[FILES[f] + (8 - i)] = { color: ch === ch.toUpperCase() ? 'w' : 'b', type: ch.toUpperCase() };
			f++;
		}
	});
	return map;
}
export function renderBoard(el, fen, orientation = 'w') {
	const pos = fenToMap(fen);
	el.innerHTML = '';
	el.classList.add('board');
	for (const sq of squaresFor(orientation)) {
		const d = document.createElement('div');
		d.className = 'square' + (isLight(sq) ? ' light' : '');
		d.dataset.square = sq;
		const p = pos[sq];
		if (p) d.innerHTML = `<svg class="piece ${p.color}" viewBox="0 0 100 100" aria-hidden="true"><use href="#lp-monolith-${p.color}${p.type}"/></svg>`;
		el.appendChild(d);
	}
	// Coordinates on the two outer edges, as in the app.
	const coords = document.createElement('div');
	coords.className = 'coords';
	const files = orientation === 'w' ? FILES : [...FILES].reverse().join('');
	const ranks = orientation === 'w' ? '87654321' : '12345678';
	coords.innerHTML = [...files].map((f, i) => `<i style="--i:${i}" class="f">${f}</i>`).join('') + [...ranks].map((r, i) => `<i style="--i:${i}" class="r">${r}</i>`).join('');
	el.appendChild(coords);
}
export function updateBoard(el, fen) {
	const pos = fenToMap(fen);
	for (const d of el.querySelectorAll('.square')) {
		const sq = d.dataset.square;
		const p = pos[sq];
		const key = p ? `${p.color}${p.type}` : '';
		if (d.dataset.piece === key) continue;
		d.dataset.piece = key;
		d.querySelector('svg.piece')?.remove();
		if (p) d.insertAdjacentHTML('afterbegin', `<svg class="piece ${p.color}" viewBox="0 0 100 100" aria-hidden="true"><use href="#lp-monolith-${p.color}${p.type}"/></svg>`);
	}
}
export function squareCenter(el, sq) {
	const d = el.querySelector(`[data-square="${sq}"]`);
	const r = d.getBoundingClientRect();
	return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
}
