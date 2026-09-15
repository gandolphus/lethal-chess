import type { ProgressStore } from './progress';
import { BrowserProgressStore } from './progress';
import type { CardState } from './scheduler';
import type { CardUpload, ProgressImport } from './server-store';
import type { Attempt } from './session.svelte';

/** The slice of ServerProgressStore sync needs — lets tests drive it with a fake. */
export type ProgressServer = {
	loadCards(bundleId: string): Promise<Map<string, CardState>>;
	loadAttempts(bundleId: string): Promise<Attempt[]>;
	importProgress(data: ProgressImport): Promise<unknown>;
};

export type SyncStatus = 'synced' | 'pending' | 'offline';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type SyncOptions = {
	userId: string;
	server: ProgressServer;
	storage?: Storage;
	onStatus?: (status: SyncStatus) => void;
	/** Retry delays after failed uploads, in ms; the last one repeats. */
	backoffMs?: number[];
	schedule?: (fn: () => void, ms: number) => unknown;
};

const attemptKey = (a: Attempt) => `${a.bundleId}|${a.epd}|${a.at}|${a.attemptNo}`;

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

	constructor(options: SyncOptions) {
		this.#options = options;
		this.#storage = options.storage ?? globalThis.localStorage;
		this.#local = new BrowserProgressStore(this.#storage, `user:${options.userId}`);
		this.#server = options.server;
		this.#outboxKey = `lethal:user:${options.userId}:outbox`;
		if (this.#outboxSize()) void this.flush();
	}

	// ── outbox ────────────────────────────────────────────────────────────────

	#readOutbox(): ProgressImport {
		try {
			const raw = this.#storage.getItem(this.#outboxKey);
			if (!raw) return { attempts: [], cards: [] };
			const parsed = JSON.parse(raw) as ProgressImport;
			return {
				attempts: parsed.attempts ?? [],
				cards: (parsed.cards ?? []).map((c) => ({ ...c, state: revive(c.state) }))
			};
		} catch {
			return { attempts: [], cards: [] };
		}
	}

	#writeOutbox(outbox: ProgressImport) {
		try {
			if (!outbox.attempts.length && !outbox.cards.length) this.#storage.removeItem(this.#outboxKey);
			else this.#storage.setItem(this.#outboxKey, JSON.stringify(outbox));
		} catch {
			// Storage unavailable: the in-flight upload is the only copy; the status will show it.
		}
	}

	#outboxSize() {
		const { attempts, cards } = this.#readOutbox();
		return attempts.length + cards.length;
	}

	#enqueue(add: Partial<ProgressImport>) {
		const outbox = this.#readOutbox();
		outbox.attempts.push(...(add.attempts ?? []));
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

	/** Uploads everything pending. Concurrent calls share one upload. */
	flush(): Promise<void> {
		this.#flushing ??= this.#upload().finally(() => (this.#flushing = null));
		return this.#flushing;
	}

	async #upload() {
		const batch = this.#readOutbox();
		if (!batch.attempts.length && !batch.cards.length) {
			this.#options.onStatus?.('synced');
			return;
		}
		try {
			await this.#server.importProgress(batch);
		} catch {
			this.#failures++;
			this.#options.onStatus?.('offline');
			this.#scheduleRetry();
			return;
		}
		this.#failures = 0;
		// Remove exactly what was sent; anything enqueued during the upload stays for the next round.
		const sentAttempts = new Set(batch.attempts.map(attemptKey));
		const outbox = this.#readOutbox();
		outbox.attempts = outbox.attempts.filter((a) => !sentAttempts.has(attemptKey(a)));
		outbox.cards = outbox.cards.filter(
			(c) => !batch.cards.some((s) => s.bundleId === c.bundleId && s.epd === c.epd && s.state.reps === c.state.reps)
		);
		this.#writeOutbox(outbox);
		if (outbox.attempts.length || outbox.cards.length) {
			queueMicrotask(() => void this.flush());
		} else {
			this.#options.onStatus?.('synced');
		}
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
			pending = this.#merge(bundleId).catch(() => {
				// Offline: drill from the local copy; the next page load pulls again.
				this.#pulled.delete(bundleId);
				this.#options.onStatus?.('offline');
			});
			this.#pulled.set(bundleId, pending);
		}
		return pending;
	}

	async #merge(bundleId: string) {
		const [remoteCards, remoteAttempts] = await Promise.all([
			this.#server.loadCards(bundleId),
			this.#server.loadAttempts(bundleId)
		]);
		const [localCards, localAttempts] = await Promise.all([
			this.#local.loadCards(bundleId),
			this.#local.loadAttempts(bundleId)
		]);

		const seen = new Set(localAttempts.map(attemptKey));
		const attempts = [...localAttempts, ...remoteAttempts.filter((a) => !seen.has(attemptKey(a)))].sort(
			(a, b) => a.at.localeCompare(b.at)
		);
		const cards = new Map(localCards);
		for (const [epd, state] of remoteCards) if (newer(cards.get(epd), state)) cards.set(epd, state);

		await this.#local.setAttempts(bundleId, attempts);
		await this.#local.setCards(bundleId, cards);
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
		for (const bundleId of bundleIds) {
			const a = await anonymous.loadAttempts(bundleId);
			const c = await anonymous.loadCards(bundleId);
			if (!a.length && !c.size) continue;
			for (const attempt of a) await this.#local.recordAttempt(attempt);
			for (const [epd, state] of c) {
				const current = (await this.#local.loadCards(bundleId)).get(epd);
				if (newer(current, state)) await this.#local.saveCard(bundleId, epd, state);
				cards.push({ bundleId, epd, state });
			}
			attempts.push(...a);
			await anonymous.clear(bundleId);
		}
		if (attempts.length || cards.length) this.#enqueue({ attempts, cards });
		return { attempts: attempts.length, cards: cards.length };
	}
}

function revive(state: CardState): CardState {
	return {
		...state,
		due: new Date(state.due),
		last_review: state.last_review ? new Date(state.last_review) : undefined
	};
}
