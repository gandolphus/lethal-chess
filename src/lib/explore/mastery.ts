import { isDue, Rating, recall, review, State, type CardState } from '$lib/drill/scheduler';
import type { Book, IndexedLine, LineStage } from './book';

export type ReviewRating = 'again' | 'hard' | 'good';

/** One review of a discovered line: the learner replayed it from memory. Append-only; card state is derived. */
export type LineReview = { bundleId: string; line: string; rating: ReviewRating; at: string };

const RATINGS = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good } as const;

/** FSRS state per line, replayed from the review log in time order. */
export function lineCards(reviews: LineReview[]): Map<string, CardState> {
	const cards = new Map<string, CardState>();
	for (const r of [...reviews].sort((a, b) => a.at.localeCompare(b.at))) {
		cards.set(r.line, review(cards.get(r.line), RATINGS[r.rating], new Date(r.at)));
	}
	return cards;
}

/** The plies where the learner moves, past the opening's defining moves. */
export const learnerPlies = (line: IndexedLine, openingLength: number, side: 'w' | 'b') =>
	line.moves.map((_, ply) => ply).filter((ply) => ply >= openingLength && (ply % 2 === 0) === (side === 'w'));

/** Lines that can be reviewed: discovered, sound, and with at least one move of the learner's own past the opening. */
export function reviewable(book: Book, stages: Map<string, LineStage>, openingLength: number, side: 'w' | 'b'): IndexedLine[] {
	return book.lines.filter(
		(line) => !line.dubious && stages.get(line.key) === 'discovered' && learnerPlies(line, openingLength, side).length > 0
	);
}

// A line counts as remembered when it has graduated to review and would likely be recalled now;
// mastered once its memory is also stable for three weeks.
const REMEMBERED_RECALL = 0.9;
const MASTERED_STABILITY_DAYS = 21;

export type Mastery = { discovered: number; remembered: number; mastered: number; due: number; nextDue: Date | null };

export function mastery(lines: IndexedLine[], cards: Map<string, CardState>, now: Date): Mastery {
	let remembered = 0;
	let mastered = 0;
	let due = 0;
	let nextDue: Date | null = null;
	for (const line of lines) {
		const card = cards.get(line.key);
		if (!card || isDue(card, now)) due++;
		else if (!nextDue || card.due < nextDue) nextDue = card.due;
		if (card?.state === State.Review && recall(card, now) >= REMEMBERED_RECALL) {
			remembered++;
			if (card.stability >= MASTERED_STABILITY_DAYS) mastered++;
		}
	}
	return { discovered: lines.length, remembered, mastered, due, nextDue };
}

/**
 * The next line to review: the most overdue reviewed line first, then lines never reviewed (oldest
 * discovery first, as `lines` is ordered by the caller), else nothing is due.
 */
export function nextLine(lines: IndexedLine[], cards: Map<string, CardState>, now: Date): IndexedLine | null {
	const overdue = lines
		.filter((line) => cards.has(line.key) && isDue(cards.get(line.key), now))
		.sort((a, b) => cards.get(a.key)!.due.getTime() - cards.get(b.key)!.due.getTime());
	return overdue[0] ?? lines.find((line) => !cards.has(line.key)) ?? null;
}
