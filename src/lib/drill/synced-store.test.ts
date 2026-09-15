import { describe, expect, it } from 'vitest';
import { BrowserProgressStore } from './progress';
import { Rating, review, type CardState } from './scheduler';
import { ProgressSyncError, type ProgressImport } from './server-store';
import type { Discovery } from '$lib/explore/book';
import type { Attempt } from './session.svelte';
import { SyncedProgressStore, type ProgressServer, type SyncStatus } from './synced-store';

function memoryStorage() {
	const data = new Map<string, string>();
	return {
		data,
		getItem: (k: string) => data.get(k) ?? null,
		setItem: (k: string, v: string) => void data.set(k, v),
		removeItem: (k: string) => void data.delete(k)
	};
}

const attempt = (epd: string, at: string, attemptNo = 1): Attempt => ({
	bundleId: 'ruy-lopez',
	epd,
	mode: 'practice',
	played: 'g1f3',
	expected: 'g1f3',
	grade: 'pass',
	costCp: 0,
	attemptNo,
	responseMs: 900,
	at
});

const discovery = (line: string, stage: Discovery['stage'], at = '2026-09-15T10:00:00.000Z'): Discovery => ({
	bundleId: 'ruy-lopez',
	line,
	stage,
	at
});

function fakeServer(
	options: { failTimes?: number; cards?: Map<string, CardState>; attempts?: Attempt[]; discoveries?: Discovery[] } = {}
) {
	let failures = options.failTimes ?? 0;
	const received: ProgressImport[] = [];
	const server: ProgressServer & { received: ProgressImport[] } = {
		received,
		loadCards: async () => options.cards ?? new Map(),
		loadAttempts: async () => options.attempts ?? [],
		loadDiscoveries: async () => options.discoveries ?? [],
		importProgress: async (data) => {
			if (failures > 0) {
				failures--;
				throw new Error('offline');
			}
			received.push(structuredClone(data));
			return { importedAttempts: data.attempts.length };
		}
	};
	return server;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('SyncedProgressStore', () => {
	it('writes locally at once and uploads in the background', async () => {
		const storage = memoryStorage();
		const server = fakeServer();
		const statuses: SyncStatus[] = [];
		const store = new SyncedProgressStore({ userId: 'u1', server, storage, onStatus: (s) => statuses.push(s) });

		await store.recordAttempt(attempt('e1', '2026-09-15T10:00:00.000Z'));
		expect(await new BrowserProgressStore(storage, 'user:u1').loadAttempts('ruy-lopez')).toHaveLength(1);

		await store.flush();
		expect(server.received.flatMap((r) => r.attempts)).toHaveLength(1);
		expect(storage.data.has('lethal:user:u1:outbox')).toBe(false);
		expect(statuses.at(-1)).toBe('synced');
	});

	it('keeps unsent progress through failures and a reload, then delivers it', async () => {
		const storage = memoryStorage();
		const retries: (() => void)[] = [];
		const statuses: SyncStatus[] = [];
		const failing = fakeServer({ failTimes: 99 });
		const store = new SyncedProgressStore({
			userId: 'u1',
			server: failing,
			storage,
			onStatus: (s) => statuses.push(s),
			schedule: (fn) => retries.push(fn)
		});

		await store.recordAttempt(attempt('e1', '2026-09-15T10:00:00.000Z'));
		await store.flush();
		expect(statuses.at(-1)).toBe('offline');
		expect(retries).toHaveLength(1); // a retry is scheduled, not a busy loop
		expect(storage.data.has('lethal:user:u1:outbox')).toBe(true);

		// The tab is closed; a new page load with a working connection sends the backlog.
		const healthy = fakeServer();
		const reloaded = new SyncedProgressStore({ userId: 'u1', server: healthy, storage });
		await reloaded.flush();
		expect(healthy.received.flatMap((r) => r.attempts).map((a) => a.epd)).toEqual(['e1']);
		expect(storage.data.has('lethal:user:u1:outbox')).toBe(false);
	});

	it('uploads only the latest state of a card that was reviewed several times while offline', async () => {
		const storage = memoryStorage();
		const now = new Date('2026-09-15T10:00:00Z');
		const first = review(undefined, Rating.Good, now);
		const second = review(first, Rating.Good, new Date('2026-09-17T10:00:00Z'));
		const server = fakeServer({ failTimes: 1 });
		const store = new SyncedProgressStore({ userId: 'u1', server, storage, schedule: () => {} });

		await store.saveCard('ruy-lopez', 'e1', first);
		await store.flush(); // fails
		await store.saveCard('ruy-lopez', 'e1', second);
		await store.flush();
		const sent = server.received.flatMap((r) => r.cards);
		expect(sent).toHaveLength(1);
		expect(sent[0].state.reps).toBe(second.reps);
	});

	it('merges another device’s progress without duplicating attempts; the newer card review wins', async () => {
		const storage = memoryStorage();
		const local = new BrowserProgressStore(storage, 'user:u1');
		const shared = attempt('e1', '2026-09-15T10:00:00.000Z');
		await local.recordAttempt(shared);
		const older = review(undefined, Rating.Again, new Date('2026-09-10T10:00:00Z'));
		const newerState = review(undefined, Rating.Good, new Date('2026-09-14T10:00:00Z'));
		await local.saveCard('ruy-lopez', 'e1', older);

		const server = fakeServer({
			attempts: [shared, attempt('e2', '2026-09-14T09:00:00.000Z')],
			cards: new Map([['e1', newerState]])
		});
		const store = new SyncedProgressStore({ userId: 'u1', server, storage });

		const attempts = await store.loadAttempts('ruy-lopez');
		expect(attempts.map((a) => a.epd)).toEqual(['e2', 'e1']); // sorted by time, no duplicate
		expect((await store.loadCards('ruy-lopez')).get('e1')?.last_review).toEqual(newerState.last_review);
	});

	it('uploads discoveries once and merges another device’s without duplicates', async () => {
		const storage = memoryStorage();
		const server = fakeServer({ discoveries: [discovery('l1', 'entered'), discovery('l2', 'discovered')] });
		const store = new SyncedProgressStore({ userId: 'u1', server, storage });

		await store.recordDiscovery(discovery('l1', 'entered'));
		await store.recordDiscovery(discovery('l1', 'entered', '2026-09-15T11:00:00.000Z')); // same stage again: ignored
		await store.recordDiscovery(discovery('l1', 'discovered'));
		await store.flush();
		await settle();
		expect(server.received.flatMap((r) => r.discoveries ?? []).map((d) => `${d.line}:${d.stage}`)).toEqual(['l1:entered', 'l1:discovered']);

		const merged = await store.loadDiscoveries('ruy-lopez');
		expect(merged.map((d) => `${d.line}:${d.stage}`).sort()).toEqual(['l1:discovered', 'l1:entered', 'l2:discovered']);
	});

	it('drops a row the server rejects instead of blocking everything behind it', async () => {
		const storage = memoryStorage();
		const server = fakeServer();
		const importProgress = server.importProgress;
		server.importProgress = async (data) => {
			const bad = data.attempts.findIndex((a) => a.responseMs < 0);
			if (bad >= 0) throw new ProgressSyncError(400, `attempts[${bad}]: invalid responseMs`);
			return importProgress(data);
		};
		const store = new SyncedProgressStore({ userId: 'u1', server, storage, schedule: () => {} });
		await store.recordAttempt(attempt('e1', '2026-09-15T10:00:00.000Z'));
		await store.recordAttempt({ ...attempt('e2', '2026-09-15T10:00:01.000Z'), responseMs: -5 });
		await store.recordAttempt(attempt('e3', '2026-09-15T10:00:02.000Z'));
		for (let i = 0; i < 5; i++) {
			await store.flush();
			await settle();
		}
		expect(server.received.flatMap((r) => r.attempts).map((a) => a.epd).sort()).toEqual(['e1', 'e3']);
		expect(store.pendingCount()).toBe(0);
	});

	it('halves an unnamed rejection down to the one row, and sends large backlogs in batches', async () => {
		const storage = memoryStorage();
		const server = fakeServer();
		const importProgress = server.importProgress;
		server.importProgress = async (data) => {
			if (data.attempts.some((a) => a.epd === 'bad')) throw new ProgressSyncError(413, 'Body too large');
			return importProgress(data);
		};
		const store = new SyncedProgressStore({ userId: 'u1', server, storage, schedule: () => {} });
		const many = Array.from({ length: 1200 }, (_, i) => attempt(i === 700 ? 'bad' : `e${i}`, new Date(Date.UTC(2026, 8, 1) + i * 1000).toISOString()));
		storage.setItem('lethal:user:u1:outbox', JSON.stringify({ attempts: many, cards: [], discoveries: [] }));
		for (let i = 0; i < 200 && store.pendingCount(); i++) {
			await store.flush();
			await settle();
		}
		expect(store.pendingCount()).toBe(0);
		expect(Math.max(...server.received.map((r) => r.attempts.length))).toBeLessThanOrEqual(500);
		expect(server.received.flatMap((r) => r.attempts)).toHaveLength(1199);
	});

	it('stops retrying and says so when the session has ended', async () => {
		const storage = memoryStorage();
		const statuses: SyncStatus[] = [];
		const retries: (() => void)[] = [];
		const server = fakeServer();
		server.importProgress = async () => {
			throw new ProgressSyncError(401, 'Sign in required');
		};
		const store = new SyncedProgressStore({ userId: 'u1', server, storage, onStatus: (s) => statuses.push(s), schedule: (fn) => retries.push(fn) });
		await store.recordAttempt(attempt('e1', '2026-09-15T10:00:00.000Z'));
		await store.flush();
		expect(statuses.at(-1)).toBe('signed-out');
		expect(retries).toHaveLength(0);
		expect(store.pendingCount()).toBe(1);
	});

	it('still drills from the local copy when the server cannot be reached', async () => {
		const storage = memoryStorage();
		await new BrowserProgressStore(storage, 'user:u1').recordAttempt(attempt('e1', '2026-09-15T10:00:00.000Z'));
		const server: ProgressServer = {
			loadCards: async () => Promise.reject(new Error('offline')),
			loadAttempts: async () => Promise.reject(new Error('offline')),
			loadDiscoveries: async () => Promise.reject(new Error('offline')),
			importProgress: async () => ({})
		};
		const store = new SyncedProgressStore({ userId: 'u1', server, storage });
		expect(await store.loadAttempts('ruy-lopez')).toHaveLength(1);
	});

	it('adopts signed-out progress into the account exactly once', async () => {
		const storage = memoryStorage();
		const anonymous = new BrowserProgressStore(storage);
		await anonymous.recordAttempt(attempt('e1', '2026-09-15T10:00:00.000Z'));
		await anonymous.saveCard('ruy-lopez', 'e1', review(undefined, Rating.Good, new Date('2026-09-15T10:00:00Z')));
		await anonymous.recordDiscovery(discovery('l1', 'entered'));

		const server = fakeServer();
		const store = new SyncedProgressStore({ userId: 'u1', server, storage });
		expect(await store.adoptSignedOutProgress(['ruy-lopez', 'sicilian'])).toEqual({ attempts: 1, cards: 1, discoveries: 1 });
		await store.flush();
		await settle();

		expect(server.received.flatMap((r) => r.attempts)).toHaveLength(1);
		expect(server.received.flatMap((r) => r.discoveries ?? [])).toHaveLength(1);
		expect(await anonymous.loadAttempts('ruy-lopez')).toEqual([]);
		expect(await anonymous.loadDiscoveries('ruy-lopez')).toEqual([]);
		expect(await store.adoptSignedOutProgress(['ruy-lopez'])).toEqual({ attempts: 0, cards: 0, discoveries: 0 });
	});
});
