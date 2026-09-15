import type { Bundle } from '$lib/drill/bundle';
import { isDue, type CardState } from '$lib/drill/scheduler';
import type { IndexedLine } from './book';

export type TodayItem = { bundle: Bundle; line: IndexedLine; card?: CardState };

export type OpeningLines = { bundle: Bundle; lines: IndexedLine[]; cards: Map<string, CardState> };

/** The most lines one daily session asks for: a session should end, not become a backlog. */
export const TODAY_LIMIT = 10;

/**
 * Today's review: the due lines of every opening, interleaved — one opening's line, then another's —
 * so that similar positions from different openings are told apart rather than recited in blocks.
 * Within an opening the most overdue line comes first, then lines never replayed.
 */
export function planToday(openings: OpeningLines[], now: Date, limit = TODAY_LIMIT): TodayItem[] {
	const queues = openings.map(({ bundle, lines, cards }) => {
		const due = lines.filter((line) => isDue(cards.get(line.key), now));
		const reviewed = due.filter((line) => cards.has(line.key)).sort((a, b) => cards.get(a.key)!.due.getTime() - cards.get(b.key)!.due.getTime());
		const fresh = due.filter((line) => !cards.has(line.key));
		return [...reviewed, ...fresh].map((line) => ({ bundle, line, card: cards.get(line.key) }));
	});
	const plan: TodayItem[] = [];
	for (let round = 0; plan.length < limit && queues.some((q) => q.length > round); round++) {
		for (const queue of queues) if (queue[round] && plan.length < limit) plan.push(queue[round]);
	}
	return plan;
}
