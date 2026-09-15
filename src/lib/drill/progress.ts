import type { Discovery } from '$lib/explore/book';
import type { LineReview } from '$lib/explore/mastery';
import type { Bundle } from './bundle';
import { recall, State, type CardState } from './scheduler';
import type { Attempt } from './session.svelte';
import { learnerCards } from './tree';

/**
 * Where attempts and card states live. The browser implementation below serves
 * signed-out learners; the signed-in implementation talks to the server. Attempts
 * are append-only; card states are derived and can be recomputed from attempts.
 */
export interface ProgressStore {
	loadCards(bundleId: string): Promise<Map<string, CardState>>;
	saveCard(bundleId: string, epd: string, state: CardState): Promise<void>;
	recordAttempt(attempt: Attempt): Promise<void>;
	loadAttempts(bundleId: string): Promise<Attempt[]>;
	/** Lines entered and discovered while exploring. Append-only; a stage is reached once. */
	loadDiscoveries(bundleId: string): Promise<Discovery[]>;
	recordDiscovery(discovery: Discovery): Promise<boolean | void>;
	/** Reviews of discovered lines. Append-only; line schedules are derived from them. */
	loadReviews(bundleId: string): Promise<LineReview[]>;
	recordReview(review: LineReview): Promise<void>;
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

const reviveCard = (raw: CardState): CardState => ({
	...raw,
	due: new Date(raw.due),
	last_review: raw.last_review ? new Date(raw.last_review) : undefined
});

export class BrowserProgressStore implements ProgressStore {
	#storage: Storage;
	#ns: string;

	/** `namespace` separates signed-out progress ('') from each signed-in account's local copy. */
	constructor(storage: Storage = globalThis.localStorage, namespace = '') {
		this.#storage = storage;
		this.#ns = namespace ? `${namespace}:` : '';
	}

	#key(kind: 'cards' | 'attempts' | 'discoveries' | 'reviews', bundleId: string) {
		return `lethal:${this.#ns}${kind}:${bundleId}`;
	}

	/** Replaces a bundle's attempts wholesale (used when merging with the server). */
	async setAttempts(bundleId: string, attempts: Attempt[]) {
		this.#write(this.#key('attempts', bundleId), attempts);
	}

	/** Replaces a bundle's cards wholesale (used when merging with the server). */
	async setCards(bundleId: string, cards: Map<string, CardState>) {
		this.#write(this.#key('cards', bundleId), Object.fromEntries(cards));
	}

	/** Replaces a bundle's discoveries wholesale (used when merging with the server). */
	async setDiscoveries(bundleId: string, discoveries: Discovery[]) {
		this.#write(this.#key('discoveries', bundleId), discoveries);
	}

	/** Replaces a bundle's line reviews wholesale (used when merging with the server). */
	async setReviews(bundleId: string, reviews: LineReview[]) {
		this.#write(this.#key('reviews', bundleId), reviews);
	}

	async clear(bundleId: string) {
		try {
			this.#storage.removeItem(this.#key('attempts', bundleId));
			this.#storage.removeItem(this.#key('cards', bundleId));
			this.#storage.removeItem(this.#key('discoveries', bundleId));
			this.#storage.removeItem(this.#key('reviews', bundleId));
		} catch {
			// Nothing to clear if storage is unavailable.
		}
	}

	#read<T>(key: string, fallback: T): T {
		try {
			const raw = this.#storage.getItem(key);
			return raw ? (JSON.parse(raw) as T) : fallback;
		} catch {
			return fallback; // storage unavailable or corrupted: behave as a fresh learner
		}
	}

	#write(key: string, value: unknown) {
		try {
			this.#storage.setItem(key, JSON.stringify(value));
		} catch {
			// Quota or private mode. Progress for this session is lost, not the session itself.
		}
	}

	async loadCards(bundleId: string) {
		const raw = this.#read<Record<string, CardState>>(this.#key("cards", bundleId), {});
		return new Map(Object.entries(raw).map(([epd, state]) => [epd, reviveCard(state)]));
	}

	async saveCard(bundleId: string, epd: string, state: CardState) {
		const key = this.#key("cards", bundleId);
		this.#write(key, { ...this.#read<Record<string, CardState>>(key, {}), [epd]: state });
	}

	async recordAttempt(attempt: Attempt) {
		const key = this.#key("attempts", attempt.bundleId);
		this.#write(key, [...this.#read<Attempt[]>(key, []), attempt]);
	}

	async loadAttempts(bundleId: string) {
		return this.#read<Attempt[]>(this.#key("attempts", bundleId), []);
	}

	async loadDiscoveries(bundleId: string) {
		return this.#read<Discovery[]>(this.#key('discoveries', bundleId), []);
	}

	/** Returns whether the discovery was new. */
	async recordDiscovery(discovery: Discovery) {
		const key = this.#key('discoveries', discovery.bundleId);
		const known = this.#read<Discovery[]>(key, []);
		if (known.some((d) => d.line === discovery.line && d.stage === discovery.stage)) return false;
		this.#write(key, [...known, discovery]);
		return true;
	}

	async loadReviews(bundleId: string) {
		return this.#read<LineReview[]>(this.#key('reviews', bundleId), []);
	}

	async recordReview(review: LineReview) {
		const key = this.#key('reviews', review.bundleId);
		this.#write(key, [...this.#read<LineReview[]>(key, []), review]);
	}
}

export type Proficiency = {
	cards: number;
	/** Share of the repertoire's decisions the learner has ever played correctly. */
	coverage: number;
	/** Share of the repertoire's decisions the learner would likely recall right now (recall ≥ 0.9). */
	retention: number;
	/** First-try pass rate over the most recent practice decisions; null before any practice. */
	precision: number | null;
	/** Median response time on first-try passes, in ms; null before any. */
	medianResponseMs: number | null;
	/** The decisions failed most often, worst first. */
	weakest: { epd: string; failures: number }[];
};

const RECENT = 50;
const KNOWN_RECALL = 0.9;

export function proficiency(bundle: Bundle, cards: Map<string, CardState>, attempts: Attempt[], now: Date): Proficiency {
	const all = learnerCards(bundle);
	const practice = attempts.filter((a) => a.mode === 'practice');
	const firstTries = practice.filter((a) => a.attemptNo === 1);

	// A pass after a reveal is being shown the answer, not knowing it: only first tries count.
	const passed = new Set(firstTries.filter((a) => a.grade === 'pass').map((a) => a.epd));
	// Only graduated cards count as known: a card failed a minute ago has recall ~1.0 but is still
	// being (re)learned, and counting it made Retention exceed Coverage right after a mistake.
	const known = all.filter((epd) => {
		const card = cards.get(epd);
		return card?.state === State.Review && recall(card, now) >= KNOWN_RECALL;
	}).length;

	const recent = firstTries.slice(-RECENT);
	const passTimes = firstTries
		.filter((a) => a.grade === 'pass')
		.map((a) => a.responseMs)
		.sort((a, b) => a - b);

	const failures = new Map<string, number>();
	for (const a of firstTries) if (a.grade === 'fail') failures.set(a.epd, (failures.get(a.epd) ?? 0) + 1);

	return {
		cards: all.length,
		coverage: all.length ? all.filter((epd) => passed.has(epd)).length / all.length : 0,
		retention: all.length ? known / all.length : 0,
		precision: recent.length ? recent.filter((a) => a.grade === 'pass').length / recent.length : null,
		medianResponseMs: passTimes.length ? passTimes[Math.floor(passTimes.length / 2)] : null,
		weakest: [...failures]
			.map(([epd, count]) => ({ epd, failures: count }))
			.sort((a, b) => b.failures - a.failures)
			.slice(0, 5)
	};
}
