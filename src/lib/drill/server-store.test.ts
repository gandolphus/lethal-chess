import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDatabase } from '$lib/server/test-db';
import { fakeEvent } from '$lib/server/test-event';
import { upsertGoogleUser, type User } from '$lib/server/users';
import { POST as postAttempts } from '../../routes/api/attempts/+server';
import { PUT as putCards } from '../../routes/api/cards/+server';
import { GET as getProgress } from '../../routes/api/progress/[bundleId]/+server';
import { POST as postImport } from '../../routes/api/progress/import/+server';
import { BrowserProgressStore } from './progress';
import { review, Rating } from './scheduler';
import { collectProgress, ProgressSyncError, ServerProgressStore } from './server-store';
import type { Attempt } from './session.svelte';

const EPD = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -';

const attempt = (overrides: Partial<Attempt> = {}): Attempt => ({
	bundleId: 'ruy-lopez',
	epd: EPD,
	mode: 'practice',
	played: 'g1f3',
	expected: 'g1f3',
	grade: 'pass',
	costCp: 0,
	attemptNo: 1,
	responseMs: 900,
	at: '2026-09-15T10:00:00.000Z',
	...overrides
});

let db: TestDatabase;
let user: User | null;
let calls: string[];

/** A fetch that runs the real endpoints against an in-memory database. */
const serverFetch: typeof fetch = async (input, init) => {
	const url = new URL(String(input), 'http://localhost:5177');
	const method = init?.method ?? 'GET';
	calls.push(`${method} ${url.pathname}`);
	const body = init?.body as string | undefined;
	const event = fakeEvent({ db, user, url: url.pathname, method, body, headers: init?.headers as Record<string, string> });
	const route = url.pathname.match(/^\/api\/progress\/([^/]+)$/);
	if (method === 'POST' && url.pathname === '/api/progress/import') return postImport(event as never);
	if (route && method === 'GET') return getProgress({ ...event, params: { bundleId: route[1] } } as never);
	if (method === 'POST' && url.pathname === '/api/attempts') return postAttempts(event as never);
	if (method === 'PUT' && url.pathname === '/api/cards') return putCards(event as never);
	return new Response(null, { status: 404 });
};

beforeEach(async () => {
	db = createTestDb();
	calls = [];
	user = await upsertGoogleUser(db, { sub: 's', email: 'e@example.com', name: 'E', picture: null }, new Date());
});

describe('ServerProgressStore', () => {
	it('round-trips real FSRS card states with their Date fields revived', async () => {
		const store = new ServerProgressStore(serverFetch);
		const reviewed = review(undefined, Rating.Good, new Date('2026-09-15T10:00:00.000Z'));
		const again = review(reviewed, Rating.Again, new Date('2026-09-16T10:00:00.000Z'));
		await store.saveCard('ruy-lopez', EPD, again);

		const cards = await store.loadCards('ruy-lopez');
		const loaded = cards.get(EPD)!;
		expect(loaded.due).toBeInstanceOf(Date);
		expect(loaded.last_review).toBeInstanceOf(Date);
		expect(loaded).toStrictEqual({ ...again });
	});

	it('records attempts and loads them back', async () => {
		const store = new ServerProgressStore(serverFetch);
		await store.recordAttempt(attempt());
		await store.recordAttempt(attempt({ at: '2026-09-15T10:00:03.000Z', attemptNo: 2 }));
		expect(await store.loadAttempts('ruy-lopez')).toEqual([attempt(), attempt({ at: '2026-09-15T10:00:03.000Z', attemptNo: 2 })]);
		expect(await store.loadAttempts('italian-game')).toEqual([]);
	});

	it('shares one request between concurrent loadCards and loadAttempts', async () => {
		const store = new ServerProgressStore(serverFetch);
		await Promise.all([store.loadCards('ruy-lopez'), store.loadAttempts('ruy-lopez')]);
		expect(calls).toEqual(['GET /api/progress/ruy-lopez']);
	});

	it('throws ProgressSyncError with the status when signed out', async () => {
		user = null;
		const store = new ServerProgressStore(serverFetch);
		await expect(store.recordAttempt(attempt())).rejects.toMatchObject({ status: 401, message: 'Not signed in' });
		await expect(store.loadCards('ruy-lopez')).rejects.toBeInstanceOf(ProgressSyncError);
	});

	it('reports network failures as status 0', async () => {
		const store = new ServerProgressStore(async () => {
			throw new TypeError('offline');
		});
		await expect(store.loadAttempts('ruy-lopez')).rejects.toMatchObject({ status: 0 });
	});

	it('imports a signed-out learner’s browser progress once, however often it is sent', async () => {
		const memory = new Map<string, string>();
		const browser = new BrowserProgressStore({ getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => void memory.set(k, v), removeItem: (k) => void memory.delete(k) });
		const state = review(undefined, Rating.Good, new Date('2026-09-15T10:00:00.000Z'));
		await browser.recordAttempt(attempt());
		await browser.saveCard('ruy-lopez', EPD, state);

		const store = new ServerProgressStore(serverFetch);
		const local = await collectProgress(browser, ['ruy-lopez', 'italian-game']);
		expect(await store.importProgress(local)).toEqual({ importedAttempts: 1, cards: 1 });
		expect(await store.importProgress(local)).toEqual({ importedAttempts: 0, cards: 1 });

		expect(await store.loadAttempts('ruy-lopez')).toEqual([attempt()]);
		expect((await store.loadCards('ruy-lopez')).get(EPD)).toStrictEqual({ ...state });
	});
});
