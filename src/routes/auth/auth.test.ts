import { isHttpError, isRedirect } from '@sveltejs/kit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STATE_COOKIE, VERIFIER_COOKIE } from '$lib/server/google';
import { createSession, generateSessionToken, SESSION_COOKIE, validateSessionToken } from '$lib/server/session';
import { createTestDb, type TestDatabase } from '$lib/server/test-db';
import { call, fakeEvent, type EventInit } from '$lib/server/test-event';
import { GET as start } from './google/+server';
import { GET as callback } from './google/callback/+server';
import { POST as logout } from './logout/+server';

const env = { GOOGLE_CLIENT_ID: 'client-123.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'shh' };
const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

function idToken(overrides: Record<string, unknown> = {}) {
	const claims = {
		iss: 'https://accounts.google.com',
		aud: env.GOOGLE_CLIENT_ID,
		sub: '1234567890',
		email: 'ann@example.com',
		email_verified: true,
		name: 'Ann Example',
		picture: 'https://lh3.googleusercontent.com/a/pic',
		iat: Math.floor(Date.now() / 1000),
		exp: Math.floor(Date.now() / 1000) + 3600,
		...overrides
	};
	return `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(claims)}.c2ln`;
}

const tokens = (id_token?: string) =>
	Response.json({ token_type: 'Bearer', access_token: 'at', expires_in: 3600, scope: 'openid email profile', id_token });

let db: TestDatabase;
// Google's token endpoint, stubbed at the network boundary so the real exchange code runs.
let exchange: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
	db = createTestDb();
	exchange = vi.fn<typeof fetch>(async () => tokens(idToken()));
	vi.stubGlobal('fetch', exchange);
});
afterEach(() => vi.unstubAllGlobals());

const callbackEvent = (init: EventInit = {}) =>
	fakeEvent({
		url: '/auth/google/callback?code=abc&state=s1',
		cookies: { [STATE_COOKIE]: 's1', [VERIFIER_COOKIE]: 'v1' },
		db,
		env,
		...init
	});

const userCount = () => (db.sqlite.prepare('SELECT count(*) AS n FROM users').get() as { n: number }).n;

describe('GET /auth/google', () => {
	it('answers 503 with a clear message when credentials are missing', async () => {
		const result = await call(start, fakeEvent({ url: '/auth/google', db }));
		expect(isHttpError(result, 503)).toBe(true);
		expect((result as { body: { message: string } }).body.message).toContain('GOOGLE_CLIENT_ID');
	});

	it('redirects to Google with state and an S256 PKCE challenge, remembering both in cookies', async () => {
		const event = fakeEvent({ url: '/auth/google', db, env });
		const result = await call(start, event);
		expect(isRedirect(result)).toBe(true);

		const location = new URL((result as { location: string }).location);
		expect(location.origin + location.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
		expect(location.searchParams.get('client_id')).toBe(env.GOOGLE_CLIENT_ID);
		expect(location.searchParams.get('redirect_uri')).toBe('http://localhost:5177/auth/google/callback');
		expect(location.searchParams.get('scope')).toBe('openid email profile');
		expect(location.searchParams.get('code_challenge_method')).toBe('S256');
		expect(location.searchParams.get('state')).toBe(event.cookies.get(STATE_COOKIE));
		expect(event.cookies.get(VERIFIER_COOKIE)).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(location.searchParams.get('code_challenge')).not.toBe(event.cookies.get(VERIFIER_COOKIE));
		expect(event.cookies.jar.get(STATE_COOKIE)?.options).toMatchObject({ httpOnly: true, sameSite: 'lax', maxAge: 600 });
	});
});

describe('GET /auth/google/callback', () => {
	const rejects = async (event: ReturnType<typeof callbackEvent>, status = 400) => {
		const result = await call(callback, event);
		expect(isHttpError(result, status)).toBe(true);
		expect(event.cookies.get(SESSION_COOKIE)).toBeUndefined();
		expect(event.cookies.deleted.has(STATE_COOKIE) && event.cookies.deleted.has(VERIFIER_COOKIE)).toBe(true);
		expect(userCount()).toBe(0);
	};

	it('rejects a state that does not match the cookie, without calling Google', async () => {
		await rejects(callbackEvent({ url: '/auth/google/callback?code=abc&state=forged' }));
		expect(exchange).not.toHaveBeenCalled();
	});

	it('rejects a missing state cookie', async () => {
		await rejects(callbackEvent({ cookies: { [VERIFIER_COOKIE]: 'v1' } }));
		expect(exchange).not.toHaveBeenCalled();
	});

	it('rejects a missing PKCE verifier', async () => {
		await rejects(callbackEvent({ cookies: { [STATE_COOKIE]: 's1' } }));
		expect(exchange).not.toHaveBeenCalled();
	});

	it('rejects a missing code', async () => {
		await rejects(callbackEvent({ url: '/auth/google/callback?state=s1' }));
	});

	it('passes the stored verifier to Google and rejects when Google refuses the code', async () => {
		exchange.mockImplementation(async () => Response.json({ error: 'invalid_grant', error_description: 'Bad Request' }, { status: 400 }));
		await rejects(callbackEvent());
		const body = new URLSearchParams(String(exchange.mock.calls[0][1]?.body));
		expect(body.get('code')).toBe('abc');
		expect(body.get('code_verifier')).toBe('v1');
	});

	it('answers 502 when Google cannot be reached', async () => {
		exchange.mockImplementation(async () => {
			throw new TypeError('fetch failed');
		});
		await rejects(callbackEvent(), 502);
	});

	it.each([
		['no ID token', undefined],
		['a garbage ID token', 'not-a-jwt'],
		['another audience', idToken({ aud: 'someone-else' })],
		['another issuer', idToken({ iss: 'https://evil.example' })],
		['an expired token', idToken({ exp: Math.floor(Date.now() / 1000) - 10 })],
		['an unverified email', idToken({ email_verified: false })],
		['no subject', idToken({ sub: undefined })]
	])('rejects %s', async (_, token) => {
		exchange.mockImplementation(async () => tokens(token));
		await rejects(callbackEvent());
	});

	it('bounces a cancelled consent back home', async () => {
		const result = await call(callback, callbackEvent({ url: '/auth/google/callback?error=access_denied&state=s1' }));
		expect(isRedirect(result) && result.location).toBe('/?signin=cancelled');
		expect(exchange).not.toHaveBeenCalled();
	});

	it('creates the user and a session, sets the cookie and redirects home', async () => {
		const event = callbackEvent();
		const result = await call(callback, event);
		expect(isRedirect(result) && result.location).toBe('/');

		const token = event.cookies.get(SESSION_COOKIE)!;
		expect(event.cookies.jar.get(SESSION_COOKIE)?.options).toMatchObject({ path: '/', httpOnly: true, sameSite: 'lax' });
		const session = await validateSessionToken(db, token, new Date());
		expect(session?.user).toMatchObject({
			email: 'ann@example.com',
			name: 'Ann Example',
			picture: 'https://lh3.googleusercontent.com/a/pic'
		});
	});

	it('signs a returning user into the same account, refreshing their profile', async () => {
		await call(callback, callbackEvent());
		exchange.mockImplementation(async () => tokens(idToken({ name: 'Ann Renamed', picture: undefined })));
		const event = callbackEvent();
		await call(callback, event);
		expect(userCount()).toBe(1);
		const session = await validateSessionToken(db, event.cookies.get(SESSION_COOKIE)!, new Date());
		expect(session?.user).toMatchObject({ name: 'Ann Renamed', picture: null });
	});

	it('replaces any session the browser already had', async () => {
		await call(callback, callbackEvent());
		const old = (db.sqlite.prepare('SELECT user_id FROM sessions').get() as { user_id: string }).user_id;
		const oldToken = generateSessionToken();
		const oldSession = await createSession(db, oldToken, old, new Date());
		await call(callback, callbackEvent({ session: oldSession }));
		expect(await validateSessionToken(db, oldToken, new Date())).toBeNull();
	});
});

describe('POST /auth/logout', () => {
	it('invalidates the session and clears the cookie', async () => {
		const first = callbackEvent();
		await call(callback, first);
		const token = first.cookies.get(SESSION_COOKIE)!;
		const { session, user } = (await validateSessionToken(db, token, new Date()))!;

		const event = fakeEvent({ method: 'POST', url: '/auth/logout', db, session, user, cookies: { [SESSION_COOKIE]: token } });
		const result = await call(logout, event);
		expect(isRedirect(result) && result.status).toBe(303);
		expect(event.cookies.deleted.has(SESSION_COOKIE)).toBe(true);
		expect(await validateSessionToken(db, token, new Date())).toBeNull();
	});
});
