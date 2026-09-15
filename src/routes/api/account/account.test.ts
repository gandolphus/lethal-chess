import { beforeEach, describe, expect, it } from 'vitest';
import { review, Rating } from '$lib/drill/scheduler';
import type { Attempt } from '$lib/drill/session.svelte';
import { importProgress, recordAttempts, saveCards } from '$lib/server/progress';
import { createSession, SESSION_COOKIE } from '$lib/server/session';
import { createTestDb, type TestDatabase } from '$lib/server/test-db';
import { fakeEvent } from '$lib/server/test-event';
import { upsertGoogleUser, type User } from '$lib/server/users';
import type { CardJson } from '$lib/server/validate';
import { POST as postDelete } from './delete/+server';
import { GET as getExport } from './export/+server';

const EPD = 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq -';
const now = new Date('2026-09-15T12:00:00.000Z');

const attempt = (at: string): Attempt => ({
	bundleId: 'ruy-lopez',
	epd: EPD,
	mode: 'practice',
	played: 'a7a6',
	expected: 'a7a6',
	grade: 'pass',
	costCp: 0,
	attemptNo: 1,
	responseMs: 900,
	at
});

let db: TestDatabase;
let ann: User;
let bob: User;

const count = (table: string, userColumn: string, userId: string) =>
	(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${userColumn} = ?`).get(userId) as { n: number }).n;

beforeEach(async () => {
	db = createTestDb();
	ann = await upsertGoogleUser(db, { sub: 'ann', email: 'ann@example.com', name: 'Ann', picture: null }, now);
	bob = await upsertGoogleUser(db, { sub: 'bob', email: 'bob@example.com', name: 'Bob', picture: null }, now);
	for (const user of [ann, bob]) {
		await recordAttempts(db, user.id, [attempt('2026-09-15T10:00:00.000Z'), attempt('2026-09-15T10:01:00.000Z')], now);
		const state = JSON.parse(JSON.stringify(review(undefined, Rating.Good, now))) as CardJson;
		await saveCards(db, user.id, [{ bundleId: 'ruy-lopez', epd: EPD, state }], now);
		await importProgress(db, user.id, { attempts: [], cards: [], discoveries: [{ bundleId: 'ruy-lopez', line: EPD, stage: 'entered', at: '2026-09-15T10:00:00.000Z' }] }, now);
		await createSession(db, `token-${user.id}`, user.id, now);
	}
});

describe('account export', () => {
	it('returns exactly the signed-in user’s data, without session hashes', async () => {
		const response = await getExport(fakeEvent({ db, user: ann }) as never);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-disposition')).toContain('attachment');
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		const data = await response.json();
		expect(data.account).toMatchObject({ email: 'ann@example.com', googleAccountId: 'ann' });
		expect(data.attempts).toHaveLength(2);
		expect(data.cards).toHaveLength(1);
		expect(data.discoveries).toHaveLength(1);
		expect(JSON.stringify(data)).not.toContain('bob@example.com');
		expect(JSON.stringify(data)).not.toMatch(/session/i);
	});

	it('requires sign-in', async () => {
		expect((await getExport(fakeEvent({ db }) as never)).status).toBe(401);
	});
});

describe('account deletion', () => {
	it('removes every row belonging to the user and none belonging to anyone else', async () => {
		const event = fakeEvent({ db, user: ann, method: 'POST', body: { confirm: 'delete my account' }, cookies: { [SESSION_COOKIE]: 'x' } });
		const response = await postDelete(event as never);
		expect(response.status).toBe(200);

		for (const [table, column] of [['attempts', 'user_id'], ['cards', 'user_id'], ['discoveries', 'user_id'], ['sessions', 'user_id'], ['users', 'id']]) {
			expect(count(table, column, ann.id)).toBe(0);
			expect(count(table, column, bob.id)).toBeGreaterThan(0);
		}
		expect(event.cookies.deleted.has(SESSION_COOKIE)).toBe(true);
	});

	it('refuses without the exact confirmation phrase', async () => {
		for (const body of [{}, { confirm: 'yes' }, { confirm: true }]) {
			const response = await postDelete(fakeEvent({ db, user: ann, method: 'POST', body }) as never);
			expect(response.status).toBe(400);
		}
		expect(count('users', 'id', ann.id)).toBe(1);
	});

	it('refuses a non-JSON body, so a cross-site form cannot trigger it', async () => {
		const response = await postDelete(
			fakeEvent({ db, user: ann, method: 'POST', body: 'confirm=delete my account', headers: { 'content-type': 'application/x-www-form-urlencoded' } }) as never
		);
		expect(response.status).toBe(415);
		expect(count('users', 'id', ann.id)).toBe(1);
	});

	it('requires sign-in', async () => {
		const response = await postDelete(fakeEvent({ db, method: 'POST', body: { confirm: 'delete my account' } }) as never);
		expect(response.status).toBe(401);
	});
});
