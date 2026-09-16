// Why did `?board=nocturne&pieces=monolith` render the Nocturne piece set?
import { api } from './cdp.mjs';

const B = process.env.BASE ?? 'http://localhost:5190';
for (const q of ['theme=nebula&board=nocturne&pieces=monolith', 'theme=nebula&board=material&pieces=monolith', 'theme=night&pieces=monolith']) {
	await api.goto(`${B}/settings/preview?${q}`);
	console.log(
		q,
		'→',
		await api.eval(`JSON.stringify({ search: location.search, aside: document.querySelector('aside p')?.textContent, set: document.querySelector('.piece')?.dataset.set, board: document.querySelector('.board-wrap')?.dataset.board, stored: localStorage.getItem('lethal:appearance') })`)
	);
}
api.close();
