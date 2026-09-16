import type { CardState } from '$lib/drill/scheduler';
import { stagesOf, type Book, type Discovery, type IndexedLine } from './book';
import { mastery, reviewable } from './mastery';

/** Where a learner stands with one opening: the numbers the dashboard shows and decides by. */
export type Standing = {
	/** Sound lines, dubious ones apart. */
	total: number;
	discovered: number;
	/** Entered but not yet finished. */
	entered: number;
	/** Discovered lines likely to be recalled now (review state, recall ≥ 0.9). */
	remembered: number;
	/** Remembered and stable for three weeks or more. */
	mastered: number;
	/** Lines due for review now. */
	due: number;
	/** When the next line comes back, if none is due. */
	nextDue: Date | null;
	/** The newest discovery, for "where you left off". */
	lastFound: { line: IndexedLine; at: Date } | null;
};

export function standing(
	book: Book,
	discoveries: Discovery[],
	cards: Map<string, CardState>,
	openingLength: number,
	side: 'w' | 'b',
	now: Date
): Standing {
	const stages = stagesOf(discoveries);
	let total = 0;
	let discovered = 0;
	let entered = 0;
	for (const line of book.lines) {
		if (line.dubious) continue;
		total++;
		const stage = stages.get(line.key);
		if (stage === 'discovered') discovered++;
		else if (stage === 'entered') entered++;
	}
	const memory = mastery(reviewable(book, stages, openingLength, side), cards, now);
	const byKey = new Map(book.lines.filter((line) => !line.dubious).map((line) => [line.key, line]));
	const newest = discoveries
		.filter((d) => d.stage === 'discovered' && byKey.has(d.line))
		.reduce<Discovery | null>((latest, d) => (!latest || d.at > latest.at ? d : latest), null);
	return {
		total,
		discovered,
		entered,
		remembered: memory.remembered,
		mastered: memory.mastered,
		due: memory.due,
		nextDue: memory.nextDue,
		lastFound: newest ? { line: byKey.get(newest.line)!, at: new Date(newest.at) } : null
	};
}

export type Approach = 'explore' | 'practice' | 'open';

/**
 * Which approach the dashboard leads with. Due lines come first: forgetting is the one thing that
 * cannot wait. A learner with nothing found yet, or fog left, explores. When everything is found and
 * nothing is due, what is left is to play the opening for a rating.
 */
export function promote(s: Standing): Approach {
	if (s.due > 0) return 'practice';
	if (s.discovered < s.total) return 'explore';
	return 'open';
}

/** "later today", "tomorrow", "in 6 days". */
export function dueIn(due: Date, now: Date): string {
	const days = Math.round((due.getTime() - now.getTime()) / 86_400_000);
	return days < 1 ? 'later today' : days === 1 ? 'tomorrow' : `in ${days} days`;
}

/** "just now", "2 hours ago", "yesterday", "5 days ago". */
export function ago(at: Date, now: Date): string {
	const minutes = Math.round((now.getTime() - at.getTime()) / 60_000);
	if (minutes < 60) return 'just now';
	const hours = Math.round(minutes / 60);
	if (hours < 24) return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
	const days = Math.round(hours / 24);
	return days === 1 ? 'yesterday' : `${days} days ago`;
}

const lines = (n: number) => `${n} line${n === 1 ? '' : 's'}`;

/** One line per card: what this approach would do for this learner today. */
export function statusOf(approach: Approach, s: Standing, now: Date): string {
	switch (approach) {
		case 'explore':
			if (s.discovered === 0 && s.entered === 0) return `${lines(s.total)} to find. Start here.`;
			if (s.discovered >= s.total) return 'Every line found. Play on for the fun of it.';
			return `${s.total - s.discovered} still secret${s.entered ? `, ${s.entered} entered but not finished` : ''}.`;
		case 'practice':
			if (s.discovered === 0) return 'Nothing to replay yet — explore first.';
			if (s.due > 0) return `${lines(s.due)} due now.`;
			return `All caught up${s.nextDue ? ` — the next comes back ${dueIn(s.nextDue, now)}` : ''}.`;
		case 'open':
			return 'One round of eight moves, each held to the best. Anyone can enter.';
	}
}

/** A line's name without the opening's family, e.g. "Closed, Breyer Defense" in the Ruy Lopez. */
export const shortName = (name: string) => name.replace(/^[^:]+:\s*/, '') || name;
