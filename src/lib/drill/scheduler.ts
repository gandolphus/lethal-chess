import { createEmptyCard, fsrs, Rating, State, type Card } from 'ts-fsrs';
import type { Grade } from './grade';

export { Rating, State };
export type CardState = Card;

const scheduler = fsrs({ enable_fuzz: false });

/**
 * A card's rating comes from the learner's *first* attempt on it in a walk.
 * A retry that succeeds after a failure is still a lapse — recall failed.
 */
export function ratingFor(first: Grade): Rating {
	if (first.kind === 'pass') return Rating.Good;
	if (first.kind === 'soft') return Rating.Hard;
	return Rating.Again;
}

export function review(state: CardState | undefined, rating: Rating, now: Date): CardState {
	return scheduler.next(state ?? createEmptyCard(now), now, rating as Exclude<Rating, Rating.Manual>).card;
}

export const isDue = (state: CardState | undefined, now: Date) => !state || state.due.getTime() <= now.getTime();

/** Probability the learner still recalls the card right now (0–1); 0 for a card never reviewed. */
export function recall(state: CardState | undefined, now: Date): number {
	if (!state || !state.last_review) return 0;
	return scheduler.get_retrievability(state, now, false);
}
