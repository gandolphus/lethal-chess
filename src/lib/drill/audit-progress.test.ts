import { describe, expect, it } from 'vitest';
import type { Discovery } from '$lib/explore/book';
import type { Attempt } from './session.svelte';
import { ProgressSyncError } from './server-store';
import { SyncedProgressStore, type ProgressServer, type SyncStatus } from './synced-store';

// Correctness audit 2026-09-16: demonstrations of defects in the sync outbox. `it.fails` marks the
// ones that fail against the current code; they pass once the defect is fixed, at which point vitest
// reports them as unexpected passes and the marker should be dropped.

function memoryStorage() {
	const data = new Map<string, string>();
	return {
		data,
		getItem: (k: string) => data.get(k) ?? null,
		setItem: (k: string, v: string) => void data.set(k, v),
		removeItem: (k: string) => void data.delete(k)
	};
}

const EPD = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -';

const attempt = (at: string): Attempt => ({
	bundleId: 'ruy-lopez',
	epd: EPD,
	mode: 'practice',
	played: 'g1f3',
	expected: 'g1f3',
	grade: 'pass',
	costCp: 0,
	attemptNo: 1,
	responseMs: 900,
	at
});

const discovery = (): Discovery => ({ bundleId: 'ruy-lopez', line: EPD, stage: 'entered', at: '2026-09-15T10:00:00.000Z' });

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const quietServer = (importProgress: ProgressServer['importProgress']): ProgressServer => ({
	loadCards: async () => new Map(),
	loadAttempts: async () => [],
	loadDiscoveries: async () => [],
	loadReviews: async () => [],
	importProgress
});

describe('outbox continuation', () => {
	/**
	 * After a batch is confirmed (or a rejected row is dropped) `#upload` queues `flush()` as a microtask
	 * to send what is left. That microtask runs *before* the `.finally` that clears `#flushing`, so it
	 * joins the upload that has just finished instead of starting the next one. Nothing else drives the
	 * outbox: the rest waits for the next write or reload, and the status stays "Saving…". The existing
	 * tests pass only because they call `flush()` in a loop themselves.
	 */
	it.fails('sends a backlog larger than one batch without being poked', async () => {
		const storage = memoryStorage();
		const received: number[] = [];
		const statuses: SyncStatus[] = [];
		const server = quietServer(async (data) => {
			received.push(data.attempts.length);
			return {};
		});
		const many = Array.from({ length: 1200 }, (_, i) => attempt(new Date(Date.UTC(2026, 8, 1) + i * 1000).toISOString()));
		storage.setItem('lethal:user:u1:outbox', JSON.stringify({ attempts: many, cards: [], discoveries: [], reviews: [] }));
		const store = new SyncedProgressStore({ userId: 'u1', server, storage, onStatus: (s) => statuses.push(s) });
		for (let i = 0; i < 20; i++) await settle();
		expect(received).toEqual([500, 500, 200]);
		expect(store.pendingCount()).toBe(0);
		expect(statuses.at(-1)).toBe('synced');
	});

	it.fails('goes on with the rows behind a rejected one without being poked', async () => {
		const storage = memoryStorage();
		const received: string[][] = [];
		const server = quietServer(async (data) => {
			const bad = data.attempts.findIndex((a) => a.responseMs < 0);
			if (bad >= 0) throw new ProgressSyncError(400, `attempts[${bad}]: invalid responseMs`);
			received.push(data.attempts.map((a) => a.at));
			return {};
		});
		const rows = [attempt('2026-09-15T10:00:00.000Z'), { ...attempt('2026-09-15T10:00:01.000Z'), responseMs: -5 }, attempt('2026-09-15T10:00:02.000Z')];
		storage.setItem('lethal:user:u1:outbox', JSON.stringify({ attempts: rows, cards: [], discoveries: [], reviews: [] }));
		const store = new SyncedProgressStore({ userId: 'u1', server, storage, schedule: () => {} });
		for (let i = 0; i < 20; i++) await settle();
		expect(received.flat()).toEqual(['2026-09-15T10:00:00.000Z', '2026-09-15T10:00:02.000Z']);
		expect(store.pendingCount()).toBe(0);
	});
});

describe('outbox on an unnamed 4xx with rows in two lists', () => {
	/**
	 * `#reject` halves `#limit` when the error names no row, expecting to isolate a single row and drop
	 * it. With rows in two lists the batch is never one row, `#limit` bottoms out at 1, nothing is
	 * dropped and nothing is backed off: every flush re-sends the identical batch and the outbox never
	 * drains. This is the "poisoned outbox" the soundness audit's fix was meant to end. (Were the dead
	 * continuation above fixed on its own, this would become a tight request loop.)
	 */
	it.fails('drops or backs off instead of re-sending the same batch forever', async () => {
		const storage = memoryStorage();
		let calls = 0;
		const server = quietServer(async () => {
			calls++;
			throw new ProgressSyncError(403, 'Forbidden');
		});
		storage.setItem('lethal:user:u1:outbox', JSON.stringify({ attempts: [attempt('2026-09-15T10:00:00.000Z')], cards: [], discoveries: [discovery()], reviews: [] }));
		const store = new SyncedProgressStore({ userId: 'u1', server, storage, schedule: () => {} });
		for (let i = 0; i < 20; i++) {
			await store.flush();
			await settle();
		}
		// Either the rows are dropped (as a single-list batch would be) or the store stops re-sending.
		expect(store.pendingCount() === 0 || calls < 20).toBe(true);
	});
});
