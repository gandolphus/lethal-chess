import { beforeEach, describe, expect, it } from 'vitest';
import { handle } from '../../hooks.server';
import {
	createSession,
	generateSessionToken,
	hashToken,
	invalidateSession,
	RENEW_WITHIN,
	SESSION_COOKIE,
	SESSION_TTL,
	validateSessionToken
} from './session';
import { createTestDb, type TestDatabase } from './test-db';
import { fakeEvent } from './test-event';
import { upsertGoogleUser, type User } from './users';

const DAY = 24 * 60 * 60 * 1000;
const t0 = new Date('2026-09-15T12:00:00.000Z');
const later = (ms: number) => new Date(t0.getTime() + ms);

let db: TestDatabase;
let user: User;

beforeEach(async () => {
	db = createTestDb();
	user = await upsertGoogleUser(db, { sub: 'g-1', email: 'a@example.com', name: 'Ann', picture: null }, t0);
});

describe('session tokens', () => {
	it('are 32 random bytes, base64url, and unique', () => {
		const tokens = new Set(Array.from({ length: 100 }, generateSessionToken));
		expect(tokens.size).toBe(100);
		for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
	});

	it('hash with SHA-256 to lowercase hex', async () => {
		expect(await hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
	});

	it('are never stored, only their hash', async () => {
		const token = generateSessionToken();
		const session = await createSession(db, token, user.id, t0);
		const rows = db.sqlite.prepare('SELECT id FROM sessions').all() as { id: string }[];
		expect(rows).toEqual([{ id: session.id }]);
		expect(session.id).toBe(await hashToken(token));
		expect(JSON.stringify(rows)).not.toContain(token);
	});
});

describe('validateSessionToken', () => {
	it('resolves a live session to its user', async () => {
		const token = generateSessionToken();
		await createSession(db, token, user.id, t0);
		const result = await validateSessionToken(db, token, later(DAY));
		expect(result?.user).toEqual(user);
		expect(result?.session.expiresAt).toEqual(later(SESSION_TTL));
		expect(result?.renewed).toBe(false);
	});

	it('rejects malformed and unknown tokens', async () => {
		await createSession(db, generateSessionToken(), user.id, t0);
		expect(await validateSessionToken(db, 'nope', t0)).toBeNull();
		expect(await validateSessionToken(db, generateSessionToken(), t0)).toBeNull();
		const id = (db.sqlite.prepare('SELECT id FROM sessions').get() as { id: string }).id;
		expect(await validateSessionToken(db, id, t0)).toBeNull(); // the stored hash is not a token
	});

	it('rejects and deletes an expired session', async () => {
		const token = generateSessionToken();
		await createSession(db, token, user.id, t0);
		expect(await validateSessionToken(db, token, later(SESSION_TTL))).toBeNull();
		expect(db.sqlite.prepare('SELECT count(*) AS n FROM sessions').get()).toEqual({ n: 0 });
	});

	it('slides the expiry forward once less than the renewal window remains', async () => {
		const token = generateSessionToken();
		await createSession(db, token, user.id, t0);

		const early = await validateSessionToken(db, token, later(SESSION_TTL - RENEW_WITHIN - 1));
		expect(early?.renewed).toBe(false);

		const now = later(SESSION_TTL - RENEW_WITHIN + 1);
		const renewed = await validateSessionToken(db, token, now);
		expect(renewed?.renewed).toBe(true);
		expect(renewed?.session.expiresAt).toEqual(new Date(now.getTime() + SESSION_TTL));

		// Persisted: valid past the original expiry.
		expect(await validateSessionToken(db, token, later(SESSION_TTL + DAY))).not.toBeNull();
	});

	it('stops working once invalidated', async () => {
		const token = generateSessionToken();
		const session = await createSession(db, token, user.id, t0);
		await invalidateSession(db, session.id);
		expect(await validateSessionToken(db, token, t0)).toBeNull();
	});

	it('clears a user’s expired sessions when a new one is created', async () => {
		await createSession(db, generateSessionToken(), user.id, t0);
		await createSession(db, generateSessionToken(), user.id, later(SESSION_TTL + DAY));
		expect(db.sqlite.prepare('SELECT count(*) AS n FROM sessions').get()).toEqual({ n: 1 });
	});
});

describe('handle hook', () => {
	const resolve = async () => new Response('ok');

	it('leaves locals empty without a cookie', async () => {
		const event = fakeEvent({ db });
		await handle({ event, resolve } as never);
		expect(event.locals).toEqual({ user: null, session: null });
	});

	it('populates locals from a valid cookie and marks the response private', async () => {
		const token = generateSessionToken();
		await createSession(db, token, user.id, new Date());
		const event = fakeEvent({ db, cookies: { [SESSION_COOKIE]: token } });
		const response = await handle({ event, resolve } as never);
		expect(event.locals.user).toEqual(user);
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(event.cookies.deleted.has(SESSION_COOKIE)).toBe(false);
	});

	it('re-sets the cookie with the new expiry when the session is renewed', async () => {
		const token = generateSessionToken();
		await createSession(db, token, user.id, new Date(Date.now() - SESSION_TTL + RENEW_WITHIN - DAY));
		const event = fakeEvent({ db, cookies: { [SESSION_COOKIE]: token } });
		await handle({ event, resolve } as never);
		const cookie = event.cookies.jar.get(SESSION_COOKIE);
		expect(cookie?.options).toMatchObject({ path: '/', httpOnly: true, sameSite: 'lax' });
		expect((cookie?.options as { expires: Date }).expires.getTime()).toBeGreaterThan(Date.now() + SESSION_TTL - DAY);
	});

	it('clears an invalid cookie', async () => {
		const event = fakeEvent({ db, cookies: { [SESSION_COOKIE]: generateSessionToken() } });
		await handle({ event, resolve } as never);
		expect(event.locals.user).toBeNull();
		expect(event.cookies.deleted.has(SESSION_COOKIE)).toBe(true);
	});
});
