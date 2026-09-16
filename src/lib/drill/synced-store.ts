import type { Discovery } from '$lib/explore/book';
import type { LineReview } from '$lib/explore/mastery';
import type { ProgressStore } from './progress';
import { BrowserProgressStore } from './progress';
import type { CardState } from './scheduler';
import { ProgressSyncError, type CardUpload, type ProgressImport } from './server-store';
import type { Attempt } from './session.svelte';

/** The slice of ServerProgressStore sync needs — lets tests drive it with a fake. */
export type ProgressServer = {
	loadCards(bundleId: string): Promise<Map<string, CardState>>;
	loadAttempts(bundleId: string): Promise<Attempt[]>;
	loadDiscoveries(bundleId: string): Promise<Discovery[]>;
	loadReviews(bundleId: string): Promise<LineReview[]>;
	importProgress(data: ProgressImport): Promise<unknown>;
};

export type SyncStatus = 'synced' | 'pending' | 'offline' | 'signed-out';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type SyncOptions = {
	userId: string;
	server: ProgressServer;
	storage?: Storage;
	onStatus?: (status: SyncStatus) => void;
	/** Retry delays after failed uploads, in ms; the last one repeats. */
	backoffMs?: number[];
	schedule?: (fn: () => void, ms: number) => unknown;
	pullTimeoutMs?: number;
};

const attemptKey = (a: Attempt) => `${a.bundleId}|${a.epd}|${a.at}|${a.attemptNo}`;
const discoveryKey = (d: Discovery) => `${d.bundleId}|${d.line}|${d.stage}`;
const reviewKey = (r: LineReview) => `${r.bundleId}|${r.line}|${r.at}`;

// Rows per list per upload: keeps any request well inside the server's limits.
const BATCH = 500;

type Outbox = Required<ProgressImport>;

const emptyOutbox = (): Outbox => ({ attempts: [], cards: [], discoveries: [], reviews: [] });
const outboxSize = (o: Outbox) => o.attempts.length + o.cards.length + o.discoveries.length + o.reviews.length;
const cardKey = (c: CardUpload) => `${c.bundleId}|${c.epd}|${c.state.reps}`;

/** The server will never accept this upload as it is: retrying the same rows cannot help. */
const isRejected = (error: unknown) =>
	error instanceof ProgressSyncError && error.status >= 400 && error.status < 500 && ![401, 408, 429].includes(error.status);

const newer = (a: CardState | undefined, b: CardState) =>
	!a || (b.last_review?.getTime() ?? 0) >= (a.last_review?.getTime() ?? 0);

/**
 * Local-first progress for a signed-in learner. Every write lands in the browser
 * immediately and in a persistent outbox; the outbox uploads in the background
 * and retries with backoff until the server confirms. The server's import endpoint
 * is idempotent (attempts deduplicated, cards merged by most recent review), so a
 * retry — or a reload that re-sends — can never duplicate anything. Reads merge the
 * account's server copy (progress from other devices) into the local copy once per
 * opening per page load.
 */
export class SyncedProgressStore implements ProgressStore {
	#local: BrowserProgressStore;
	#server: ProgressServer;
	#storage: Storage;
	#outboxKey: string;
	#options: SyncOptions;
	#pulled = new Map<string, Promise<void>>();
	#flushing: Promise<void> | null = null;
	#failures = 0;
	#retryScheduled = false;
	#limit = BATCH;

	constructor(options: SyncOptions) {
		this.#options = options;
		this.#storage = options.storage ?? globalThis.localStorage;
		this.#local = new BrowserProgressStore(this.#storage, `user:${options.userId}`);
		this.#server = options.server;
		this.#outboxKey = `lethal:user:${options.userId}:outbox`;
		if (this.pendingCount()) void this.flush();
	}

	// ── outbox ────────────────────────────────────────────────────────────────

	#readOutbox(): Outbox {
		try {
			const raw = this.#storage.getItem(this.#outboxKey);
			if (!raw) return emptyOutbox();
			const parsed = JSON.parse(raw) as ProgressImport;
			return {
				attempts: parsed.attempts ?? [],
				cards: (parsed.cards ?? []).map((c) => ({ ...c, state: revive(c.state) })),
				discoveries: parsed.discoveries ?? [],
				reviews: parsed.reviews ?? []
			};
		} catch {
			return emptyOutbox();
		}
	}

	#writeOutbox(outbox: Outbox) {
		try {
			if (!outboxSize(outbox)) this.#storage.removeItem(this.#outboxKey);
			else this.#storage.setItem(this.#outboxKey, JSON.stringify(outbox));
		} catch {
			// Storage unavailable: the in-flight upload is the only copy; the status will show it.
		}
	}

	/** Rows not yet confirmed by the server. */
	pendingCount() {
		return outboxSize(this.#readOutbox());
	}

	#enqueue(add: Partial<ProgressImport>) {
		const outbox = this.#readOutbox();
		outbox.attempts.push(...(add.attempts ?? []));
		outbox.discoveries.push(...(add.discoveries ?? []));
		outbox.reviews.push(...(add.reviews ?? []));
		for (const card of add.cards ?? []) {
			// Only the latest state of a card needs uploading.
			const i = outbox.cards.findIndex((c) => c.bundleId === card.bundleId && c.epd === card.epd);
			if (i >= 0) outbox.cards[i] = card;
			else outbox.cards.push(card);
		}
		this.#writeOutbox(outbox);
		this.#options.onStatus?.('pending');
		void this.flush();
	}

	/**
	 * Uploads everything pending. Concurrent calls share one upload, and an upload that leaves rows behind
	 * starts the next one itself.
	 *
	 * The continuation belongs here rather than inside `#upload`: a microtask queued in there runs *before*
	 * this `.finally`, so it joined the upload that was already finishing and started nothing. A backlog
	 * over one batch then moved a batch per write, and the status never came back from "Saving…".
	 */
	flush(): Promise<void> {
		this.#flushing ??= this.#upload().finally(() => {
			this.#flushing = null;
			if (this.#more) {
				this.#more = false;
				void this.flush();
			}
		});
		return this.#flushing;
	}

	/** Set by an upload that left rows behind, read by `flush` once this one is properly finished. */
	#more = false;

	async #upload() {
		const pending = this.#readOutbox();
		if (!outboxSize(pending)) {
			this.#options.onStatus?.('synced');
			return;
		}
		const batch: Outbox = {
			attempts: pending.attempts.slice(0, this.#limit),
			cards: pending.cards.slice(0, this.#limit),
			discoveries: pending.discoveries.slice(0, this.#limit),
			reviews: pending.reviews.slice(0, this.#limit)
		};
		try {
			await this.#server.importProgress(batch);
		} catch (error) {
			if (isRejected(error)) {
				this.#reject(batch, error as ProgressSyncError);
				this.#more = true;
			} else if (error instanceof ProgressSyncError && error.status === 401) {
				// The session is gone (signed out elsewhere, or the account deleted). Keep the rows; a sign-in resumes.
				this.#options.onStatus?.('signed-out');
			} else {
				this.#failures++;
				this.#options.onStatus?.('offline');
				this.#scheduleRetry();
			}
			return;
		}
		this.#failures = 0;
		// Remove exactly what was sent; anything enqueued during the upload stays for the next round.
		const outbox = this.#without(this.#readOutbox(), batch);
		this.#writeOutbox(outbox);
		if (outboxSize(outbox)) this.#more = true;
		else this.#options.onStatus?.('synced');
	}

	#without(outbox: Outbox, remove: Partial<Outbox>): Outbox {
		const attempts = new Set((remove.attempts ?? []).map(attemptKey));
		const cards = new Set((remove.cards ?? []).map(cardKey));
		const discoveries = new Set((remove.discoveries ?? []).map(discoveryKey));
		const reviews = new Set((remove.reviews ?? []).map(reviewKey));
		return {
			attempts: outbox.attempts.filter((a) => !attempts.has(attemptKey(a))),
			cards: outbox.cards.filter((c) => !cards.has(cardKey(c))),
			discoveries: outbox.discoveries.filter((d) => !discoveries.has(discoveryKey(d))),
			reviews: outbox.reviews.filter((r) => !reviews.has(reviewKey(r)))
		};
	}

	/**
	 * A row the server rejects would block everything behind it forever. The server names the first bad
	 * row ("attempts[3]: invalid responseMs"); that row is dropped. Without a name (e.g. a body too
	 * large), the batch is halved until the offending row is alone, then dropped.
	 */
	#reject(batch: Outbox, error: ProgressSyncError) {
		const named = /^(attempts|cards|discoveries|reviews)\[(\d+)\]/.exec(error.message);
		let drop: Partial<Outbox> | null = null;
		if (named) {
			const list = named[1] as keyof Outbox;
			const row = batch[list][Number(named[2])];
			if (row) drop = { [list]: [row] };
		} else if (outboxSize(batch) === 1) {
			drop = batch;
		} else {
			const longest = Math.max(batch.attempts.length, batch.cards.length, batch.discoveries.length, batch.reviews.length);
			// `#limit` caps each list, so a batch of one attempt and one discovery is two rows at limit 1 and
			// halving cannot shrink it. Without this the same batch went back unchanged for ever.
			if (longest > 1) {
				this.#limit = Math.max(1, Math.floor(longest / 2));
				return;
			}
		}
		if (!drop) drop = { attempts: batch.attempts.slice(0, 1), cards: batch.cards.slice(0, 1), discoveries: batch.discoveries.slice(0, 1), reviews: batch.reviews.slice(0, 1) };
		console.warn('Progress rows rejected by the server and dropped:', error.message, drop);
		this.#writeOutbox(this.#without(this.#readOutbox(), drop));
		this.#limit = BATCH;
	}

	#scheduleRetry() {
		if (this.#retryScheduled) return;
		this.#retryScheduled = true;
		const delays = this.#options.backoffMs ?? [1000, 2000, 5000, 15000, 30000, 60000];
		const delay = delays[Math.min(this.#failures - 1, delays.length - 1)];
		(this.#options.schedule ?? setTimeout)(() => {
			this.#retryScheduled = false;
			void this.flush();
		}, delay);
	}

	// ── pull + merge ──────────────────────────────────────────────────────────

	#pull(bundleId: string): Promise<void> {
		let pending = this.#pulled.get(bundleId);
		if (!pending) {
			// A hung connection must not keep the drill waiting: the local copy is right here.
			const timeout = new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('Progress pull timed out')), this.#options.pullTimeoutMs ?? 8000)
			);
			pending = Promise.race([this.#merge(bundleId), timeout]).catch(() => {
				// Offline: drill from the local copy; the next page load pulls again.
				this.#pulled.delete(bundleId);
				this.#options.onStatus?.('offline');
			});
			this.#pulled.set(bundleId, pending);
		}
		return pending;
	}

	async #merge(bundleId: string) {
		const [remoteCards, remoteAttempts, remoteDiscoveries, remoteReviews] = await Promise.all([
			this.#server.loadCards(bundleId),
			this.#server.loadAttempts(bundleId),
			this.#server.loadDiscoveries(bundleId),
			this.#server.loadReviews(bundleId)
		]);
		const [localCards, localAttempts, localDiscoveries, localReviews] = await Promise.all([
			this.#local.loadCards(bundleId),
			this.#local.loadAttempts(bundleId),
			this.#local.loadDiscoveries(bundleId),
			this.#local.loadReviews(bundleId)
		]);

		const seen = new Set(localAttempts.map(attemptKey));
		const attempts = [...localAttempts, ...remoteAttempts.filter((a) => !seen.has(attemptKey(a)))].sort(
			(a, b) => a.at.localeCompare(b.at)
		);
		const cards = new Map(localCards);
		for (const [epd, state] of remoteCards) if (newer(cards.get(epd), state)) cards.set(epd, state);

		const found = new Set(localDiscoveries.map(discoveryKey));
		const discoveries = [...localDiscoveries, ...remoteDiscoveries.filter((d) => !found.has(discoveryKey(d)))];

		await this.#local.setAttempts(bundleId, attempts);
		await this.#local.setCards(bundleId, cards);
		await this.#local.setDiscoveries(bundleId, discoveries);
		const reviewed = new Set(localReviews.map(reviewKey));
		await this.#local.setReviews(bundleId, [...localReviews, ...remoteReviews.filter((r) => !reviewed.has(reviewKey(r)))]);
	}

	// ── ProgressStore ─────────────────────────────────────────────────────────

	async loadCards(bundleId: string) {
		await this.#pull(bundleId);
		return this.#local.loadCards(bundleId);
	}

	async loadAttempts(bundleId: string) {
		await this.#pull(bundleId);
		return this.#local.loadAttempts(bundleId);
	}

	async loadDiscoveries(bundleId: string) {
		await this.#pull(bundleId);
		return this.#local.loadDiscoveries(bundleId);
	}

	async recordDiscovery(discovery: Discovery) {
		if (await this.#local.recordDiscovery(discovery)) this.#enqueue({ discoveries: [discovery] });
	}

	async loadReviews(bundleId: string) {
		await this.#pull(bundleId);
		return this.#local.loadReviews(bundleId);
	}

	async recordReview(review: LineReview) {
		await this.#local.recordReview(review);
		this.#enqueue({ reviews: [review] });
	}

	async saveCard(bundleId: string, epd: string, state: CardState) {
		await this.#local.saveCard(bundleId, epd, state);
		this.#enqueue({ cards: [{ bundleId, epd, state }] });
	}

	async recordAttempt(attempt: Attempt) {
		await this.#local.recordAttempt(attempt);
		this.#enqueue({ attempts: [attempt] });
	}

	/**
	 * Moves progress made while signed out on this browser into the account: it joins
	 * the local copy and the outbox, then the signed-out copy is cleared so it is
	 * never adopted twice.
	 */
	async adoptSignedOutProgress(bundleIds: string[]) {
		const anonymous = new BrowserProgressStore(this.#storage);
		const attempts: Attempt[] = [];
		const cards: CardUpload[] = [];
		const discoveries: Discovery[] = [];
		const reviews: LineReview[] = [];
		for (const bundleId of bundleIds) {
			const a = await anonymous.loadAttempts(bundleId);
			const c = await anonymous.loadCards(bundleId);
			const d = await anonymous.loadDiscoveries(bundleId);
			const r = await anonymous.loadReviews(bundleId);
			if (!a.length && !c.size && !d.length && !r.length) continue;
			// Merge the account's copy first: a merge finishing later would overwrite what adoption writes.
			await this.#pull(bundleId);
			// Another tab may be adopting the same history at the same moment.
			const known = new Set((await this.#local.loadAttempts(bundleId)).map(attemptKey));
			for (const attempt of a) if (!known.has(attemptKey(attempt))) await this.#local.recordAttempt(attempt);
			for (const discovery of d) await this.#local.recordDiscovery(discovery);
			discoveries.push(...d);
			const reviewed = new Set((await this.#local.loadReviews(bundleId)).map(reviewKey));
			for (const review of r) if (!reviewed.has(reviewKey(review))) await this.#local.recordReview(review);
			reviews.push(...r);
			for (const [epd, state] of c) {
				const current = (await this.#local.loadCards(bundleId)).get(epd);
				if (newer(current, state)) await this.#local.saveCard(bundleId, epd, state);
				cards.push({ bundleId, epd, state });
			}
			attempts.push(...a);
			await anonymous.clear(bundleId);
		}
		if (attempts.length || cards.length || discoveries.length || reviews.length) this.#enqueue({ attempts, cards, discoveries, reviews });
		return { attempts: attempts.length, cards: cards.length, discoveries: discoveries.length, reviews: reviews.length };
	}
}

function revive(state: CardState): CardState {
	return {
		...state,
		due: new Date(state.due),
		last_review: state.last_review ? new Date(state.last_review) : undefined
	};
}
