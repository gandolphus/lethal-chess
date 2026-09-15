import type { Discovery } from '$lib/explore/book';
import type { LineReview } from '$lib/explore/mastery';
import type { ProgressStore } from './progress';
import type { CardState } from './scheduler';
import type { Attempt } from './session.svelte';

type Fetch = typeof fetch;
type ProgressJson = { cards: Record<string, CardState>; attempts: Attempt[]; discoveries?: Discovery[]; reviews?: LineReview[] };
export type CardUpload = { bundleId: string; epd: string; state: CardState };
export type ProgressImport = { attempts: Attempt[]; cards: CardUpload[]; discoveries?: Discovery[]; reviews?: LineReview[] };

export class ProgressSyncError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
	}
}

const reviveCard = (raw: CardState): CardState => ({
	...raw,
	due: new Date(raw.due),
	last_review: raw.last_review ? new Date(raw.last_review) : undefined
});

/**
 * Progress for a signed-in learner, stored in their account via the /api endpoints.
 * Failed calls throw ProgressSyncError (status 0 for network failures); writes are idempotent,
 * so callers may simply retry them.
 */
export class ServerProgressStore implements ProgressStore {
	#fetch: Fetch;
	#inflight = new Map<string, Promise<ProgressJson>>();

	constructor(fetchFn: Fetch = (...args) => globalThis.fetch(...args)) {
		this.#fetch = fetchFn;
	}

	async #request<T>(method: string, path: string, body?: unknown): Promise<T> {
		let response: Response;
		try {
			response = await this.#fetch(path, {
				method,
				headers: body === undefined ? undefined : { 'content-type': 'application/json' },
				body: body === undefined ? undefined : JSON.stringify(body)
			});
		} catch (e) {
			throw new ProgressSyncError(0, e instanceof Error ? e.message : 'Network error');
		}
		const data = await response.json().catch(() => null);
		if (!response.ok) throw new ProgressSyncError(response.status, data?.error ?? response.statusText);
		return data as T;
	}

	/** loadCards and loadAttempts are usually called together; they share one request. */
	#progress(bundleId: string): Promise<ProgressJson> {
		let pending = this.#inflight.get(bundleId);
		if (!pending) {
			pending = this.#request<ProgressJson>('GET', `/api/progress/${encodeURIComponent(bundleId)}`).finally(() =>
				this.#inflight.delete(bundleId)
			);
			this.#inflight.set(bundleId, pending);
		}
		return pending;
	}

	async loadCards(bundleId: string) {
		const { cards } = await this.#progress(bundleId);
		return new Map(Object.entries(cards).map(([epd, state]) => [epd, reviveCard(state)]));
	}

	async saveCard(bundleId: string, epd: string, state: CardState) {
		await this.#request('PUT', '/api/cards', { cards: [{ bundleId, epd, state }] });
	}

	async recordAttempt(attempt: Attempt) {
		await this.#request('POST', '/api/attempts', { attempts: [attempt] });
	}

	async loadAttempts(bundleId: string) {
		return (await this.#progress(bundleId)).attempts;
	}

	async loadDiscoveries(bundleId: string) {
		return (await this.#progress(bundleId)).discoveries ?? [];
	}

	async recordDiscovery(discovery: Discovery) {
		await this.importProgress({ attempts: [], cards: [], discoveries: [discovery] });
	}

	async loadReviews(bundleId: string) {
		return (await this.#progress(bundleId)).reviews ?? [];
	}

	async recordReview(review: LineReview) {
		await this.importProgress({ attempts: [], cards: [], reviews: [review] });
	}

	/** Merges local (signed-out) progress into the account. Safe to call more than once. */
	async importProgress(data: ProgressImport): Promise<{ importedAttempts: number; cards: number }> {
		return this.#request('POST', '/api/progress/import', data);
	}
}

/** Gathers what another store (normally the BrowserProgressStore) holds for these openings, ready for import. */
export async function collectProgress(store: ProgressStore, bundleIds: string[]): Promise<ProgressImport> {
	const data: ProgressImport = { attempts: [], cards: [], discoveries: [], reviews: [] };
	for (const bundleId of bundleIds) {
		data.attempts.push(...(await store.loadAttempts(bundleId)));
		data.discoveries!.push(...(await store.loadDiscoveries(bundleId)));
		data.reviews!.push(...(await store.loadReviews(bundleId)));
		for (const [epd, state] of await store.loadCards(bundleId)) data.cards.push({ bundleId, epd, state });
	}
	return data;
}
