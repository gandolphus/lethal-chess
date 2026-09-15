import { createEmptyCard } from 'ts-fsrs';
import { beforeEach, describe, expect, it } from 'vitest';
import { review, Rating } from '$lib/drill/scheduler';
import type { Attempt } from '$lib/drill/session.svelte';
import { createTestDb, type TestDatabase } from '$lib/server/test-db';
import { fakeEvent, type EventInit } from '$lib/server/test-event';
import { upsertGoogleUser, type User } from '$lib/server/users';
import { POST as postAttempts } from './attempts/+server';
import { PUT as putCards } from './cards/+server';
import { GET as getProgress } from './progress/[bundleId]/+server';
import { POST as postImport } from './progress/import/+server';

const EPD = 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq -';
const EPD2 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -';

const attempt = (overrides: Partial<Attempt> = {}): Attempt => ({
	bundleId: 'ruy-lopez',
	epd: EPD,
	mode: 'practice',
	played: 'a7a6',
	expected: 'a7a6',
	grade: 'pass',
	costCp: 0,
	attemptNo: 1,
	responseMs: 1234,
	at: '2026-09-15T10:00:00.000Z',
	...overrides
});

const card = (at: string) => JSON.parse(JSON.stringify(review(undefined, Rating.Good, new Date(at))));

let db: TestDatabase;
let ann: User;
let bob: User;

beforeEach(async () => {
	db = createTestDb();
	const now = new Date();
	ann = await upsertGoogleUser(db, { sub: 'ann', email: 'ann@example.com', name: 'Ann', picture: null }, now);
	bob = await upsertGoogleUser(db, { sub: 'bob', email: 'bob@example.com', name: 'Bob', picture: null }, now);
});

type Handler = (event: never) => Promise<Response>;
async function send(handler: Handler, init: EventInit & { as?: User | null }) {
	const user = init.as === undefined ? ann : init.as;
	const response = await handler(fakeEvent({ db, user, ...init }) as never);
	return { status: response.status, body: await response.json(), headers: response.headers };
}

const progress = (as: User = ann, bundleId = 'ruy-lopez') =>
	send(getProgress as Handler, { as, url: `/api/progress/${bundleId}`, params: { bundleId } });
const attemptCount = () => (db.sqlite.prepare('SELECT count(*) AS n FROM attempts').get() as { n: number }).n;

describe('auth enforcement', () => {
	it.each([
		['GET /api/progress/[bundleId]', getProgress, 'GET', undefined],
		['POST /api/attempts', postAttempts, 'POST', { attempts: [attempt()] }],
		['PUT /api/cards', putCards, 'PUT', { cards: [] }],
		['POST /api/progress/import', postImport, 'POST', { attempts: [attempt()] }]
	])('%s is 401 when signed out and writes nothing', async (_, handler, method, body) => {
		const result = await send(handler as Handler, { as: null, method, body, params: { bundleId: 'ruy-lopez' } });
		expect(result.status).toBe(401);
		expect(result.body).toEqual({ error: 'Not signed in' });
		expect(attemptCount()).toBe(0);
	});

	it('ignores client-supplied user ids: data lands with the session user', async () => {
		const result = await send(postAttempts as Handler, {
			method: 'POST',
			body: { userId: bob.id, attempts: [{ ...attempt(), userId: bob.id, user_id: bob.id }] }
		});
		expect(result.status).toBe(200);
		expect((await progress(ann)).body.attempts).toHaveLength(1);
		expect((await progress(bob)).body.attempts).toHaveLength(0);
	});

	it('marks responses private and uncacheable', async () => {
		expect((await progress()).headers.get('cache-control')).toBe('private, no-store');
	});
});

describe('input validation', () => {
	const post = (body: unknown, headers?: Record<string, string>) =>
		send(postAttempts as Handler, { method: 'POST', body, headers });

	it('requires application/json', async () => {
		const result = await post(JSON.stringify({ attempts: [attempt()] }), { 'content-type': 'text/plain' });
		expect(result.status).toBe(415);
	});

	it('rejects malformed JSON and non-object bodies', async () => {
		expect((await post('{nope')).status).toBe(400);
		expect((await post([attempt()])).status).toBe(400);
	});

	it.each([
		['an empty batch', { attempts: [] }],
		['an oversized batch', { attempts: Array.from({ length: 501 }, (_, i) => attempt({ responseMs: i })) }],
		['a bad bundle id', { attempts: [attempt({ bundleId: '../etc' })] }],
		['a bad epd', { attempts: [attempt({ epd: 'not a position' })] }],
		['an epd with empty castling', { attempts: [attempt({ epd: EPD.replace('KQkq', '') })] }],
		['a bad move', { attempts: [attempt({ played: "e2e4'); DROP TABLE users;--" })] }],
		['a bad grade', { attempts: [attempt({ grade: 'great' as never })] }],
		['a bad mode', { attempts: [attempt({ mode: 'blitz' as never })] }],
		['a fractional cost', { attempts: [attempt({ costCp: 1.5 })] }],
		['a zero attemptNo', { attempts: [attempt({ attemptNo: 0 })] }],
		['a negative responseMs', { attempts: [attempt({ responseMs: -1 })] }],
		['a non-ISO timestamp', { attempts: [attempt({ at: 'yesterday' })] }],
		['an impossible date', { attempts: [attempt({ at: '2026-02-30T10:00:00.000Z' })] }],
		['a missing field', { attempts: [{ ...attempt(), expected: undefined }] }]
	])('rejects %s with 400 and writes nothing', async (_, body) => {
		const result = await post(body);
		expect(result.status).toBe(400);
		expect(typeof result.body.error).toBe('string');
		expect(attemptCount()).toBe(0);
	});

	it('reports which item failed', async () => {
		const result = await post({ attempts: [attempt(), attempt({ grade: 'x' as never })] });
		expect(result.body.error).toBe('attempts[1]: invalid grade');
	});

	it('rejects a bad bundle id in the progress URL', async () => {
		expect((await progress(ann, 'Ruy Lopez')).status).toBe(400);
	});

	it.each([
		['a non-numeric stability', { stability: 'high' }],
		['an out-of-range state', { state: 7 }],
		['a bad due date', { due: 'soon' }],
		['a negative rep count', { reps: -1 }]
	])('rejects a card with %s', async (_, patch) => {
		const state = { ...card('2026-09-15T10:00:00.000Z'), ...patch };
		const result = await send(putCards as Handler, { method: 'PUT', body: { cards: [{ bundleId: 'ruy-lopez', epd: EPD, state }] } });
		expect(result.status).toBe(400);
	});
});

describe('progress round trip', () => {
	it('records attempts idempotently and returns them in order', async () => {
		const batch = [attempt({ at: '2026-09-15T10:00:02.000Z', epd: EPD2, played: 'g1f3', expected: 'g1f3' }), attempt()];
		expect((await send(postAttempts as Handler, { method: 'POST', body: { attempts: batch } })).body).toEqual({ inserted: 2 });
		expect((await send(postAttempts as Handler, { method: 'POST', body: { attempts: batch } })).body).toEqual({ inserted: 0 });

		const { body } = await progress();
		expect(body.attempts).toEqual([batch[1], batch[0]]);
	});

	it('keeps a retry of the same position as a separate attempt', async () => {
		const miss = attempt({ grade: 'fail', played: 'g8f6', costCp: null });
		const retry = attempt({ attemptNo: 2 });
		await send(postAttempts as Handler, { method: 'POST', body: { attempts: [miss, retry] } });
		expect((await progress()).body.attempts).toEqual([miss, retry]);
	});

	it('saves cards, overwriting on PUT, scoped per bundle', async () => {
		const first = card('2026-09-10T10:00:00.000Z');
		const second = card('2026-09-01T10:00:00.000Z');
		await send(putCards as Handler, { method: 'PUT', body: { cards: [{ bundleId: 'ruy-lopez', epd: EPD, state: first }] } });
		const result = await send(putCards as Handler, {
			method: 'PUT',
			body: { cards: [{ bundleId: 'ruy-lopez', epd: EPD, state: { ...second, extra: 'dropped' } }] }
		});
		expect(result.body).toEqual({ saved: 1 });
		expect((await progress()).body.cards).toEqual({ [EPD]: second });
		expect((await progress(ann, 'italian-game')).body.cards).toEqual({});
	});

	it('stores a never-reviewed card without last_review', async () => {
		const fresh = JSON.parse(JSON.stringify(createEmptyCard(new Date('2026-09-15T10:00:00.000Z'))));
		await send(putCards as Handler, { method: 'PUT', body: { cards: [{ bundleId: 'ruy-lopez', epd: EPD, state: fresh }] } });
		expect((await progress()).body.cards[EPD]).not.toHaveProperty('last_review');
	});
});

describe('POST /api/progress/import', () => {
	const local = {
		attempts: [
			attempt(),
			attempt({ at: '2026-09-15T10:00:05.000Z', epd: EPD2, played: 'g1f3', expected: 'g1f3' }),
			attempt({ bundleId: 'italian-game', at: '2026-09-15T11:00:00.000Z' })
		],
		cards: [
			{ bundleId: 'ruy-lopez', epd: EPD, state: card('2026-09-15T10:00:00.000Z') },
			{ bundleId: 'italian-game', epd: EPD, state: card('2026-09-15T11:00:00.000Z') }
		]
	};
	const importLocal = (body: unknown, as: User = ann) => send(postImport as Handler, { as, method: 'POST', body });

	it('imports everything, and importing again duplicates nothing', async () => {
		expect((await importLocal(local)).body).toEqual({ importedAttempts: 3, cards: 2 });
		const once = { ruy: (await progress()).body, italian: (await progress(ann, 'italian-game')).body };

		expect((await importLocal(local)).body).toEqual({ importedAttempts: 0, cards: 2 });
		expect(attemptCount()).toBe(3);
		expect((await progress()).body).toEqual(once.ruy);
		expect((await progress(ann, 'italian-game')).body).toEqual(once.italian);
		expect(once.ruy.attempts).toHaveLength(2);
		expect(once.ruy.cards[EPD]).toEqual(local.cards[0].state);
	});

	it('merges with attempts already in the account', async () => {
		await send(postAttempts as Handler, { method: 'POST', body: { attempts: [local.attempts[0]] } });
		expect((await importLocal(local)).body.importedAttempts).toBe(2);
		expect(attemptCount()).toBe(3);
	});

	it('never replaces a card the account reviewed more recently', async () => {
		const newer = card('2026-09-20T10:00:00.000Z');
		await send(putCards as Handler, { method: 'PUT', body: { cards: [{ bundleId: 'ruy-lopez', epd: EPD, state: newer }] } });
		await importLocal(local);
		expect((await progress()).body.cards[EPD]).toEqual(newer);
		expect((await progress(ann, 'italian-game')).body.cards[EPD]).toEqual(local.cards[1].state);
	});

	it('replaces an account card that is older than the local one', async () => {
		const older = card('2026-09-01T10:00:00.000Z');
		await send(putCards as Handler, { method: 'PUT', body: { cards: [{ bundleId: 'ruy-lopez', epd: EPD, state: older }] } });
		await importLocal(local);
		expect((await progress()).body.cards[EPD]).toEqual(local.cards[0].state);
	});

	it('keeps each user’s import to themselves', async () => {
		await importLocal(local, bob);
		expect((await progress(ann)).body).toEqual({ cards: {}, attempts: [], discoveries: [] });
		expect((await progress(bob)).body.attempts).toHaveLength(2);
	});

	it('is all-or-nothing on invalid input', async () => {
		const result = await importLocal({ ...local, cards: [...local.cards, { bundleId: 'ruy-lopez', epd: EPD, state: {} }] });
		expect(result.status).toBe(400);
		expect(attemptCount()).toBe(0);
	});

	it('imports discoveries idempotently and rejects unknown stages', async () => {
		const found = { bundleId: 'ruy-lopez', line: EPD2, stage: 'discovered', at: '2026-09-15T10:00:00.000Z' };
		await importLocal({ discoveries: [found, { ...found, stage: 'entered' }] });
		await importLocal({ discoveries: [{ ...found, at: '2026-09-16T10:00:00.000Z' }] });
		// The first time a stage is reached is kept; a later re-send changes nothing.
		expect((await progress()).body.discoveries).toEqual([found, { ...found, stage: 'entered' }]);
		expect((await progress(bob)).body.discoveries).toEqual([]);
		expect((await importLocal({ discoveries: [{ ...found, stage: 'mastered' }] })).status).toBe(400);
	});

	it('accepts an empty import', async () => {
		expect((await importLocal({})).body).toEqual({ importedAttempts: 0, cards: 0 });
	});

	it('handles imports larger than one statement chunk', async () => {
		const attempts = Array.from({ length: 1234 }, (_, i) => attempt({ at: new Date(Date.UTC(2026, 8, 1) + i * 1000).toISOString() }));
		expect((await importLocal({ attempts })).body.importedAttempts).toBe(1234);
		expect((await importLocal({ attempts })).body.importedAttempts).toBe(0);
		expect(attemptCount()).toBe(1234);
	});
});
