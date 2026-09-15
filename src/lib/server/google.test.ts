import { describe, expect, it, vi } from 'vitest';
import { decodeBase64url, encodeBase64url } from './encoding';
import {
	createAuthorizationURL,
	createS256CodeChallenge,
	decodeJwtPayload,
	exchangeAuthorizationCode,
	generateCodeVerifier,
	generateState,
	parseGoogleIdToken,
	TOKEN_ENDPOINT,
	TokenEndpointFailure,
	TokenRequestRejected
} from './google';

const config = { clientId: 'client-123.apps.googleusercontent.com', clientSecret: 'shh' };
const origin = 'https://lethalchess.com';
const jwt = (payload: unknown) =>
	`${encodeBase64url(new TextEncoder().encode('{"alg":"RS256"}'))}.${encodeBase64url(new TextEncoder().encode(JSON.stringify(payload)))}.sig`;

describe('base64url', () => {
	it('round-trips every byte value without padding', () => {
		const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
		const text = encodeBase64url(bytes);
		expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(decodeBase64url(text)).toEqual(bytes);
	});

	it('rejects non-base64url input', () => {
		expect(() => decodeBase64url('a+b/')).toThrow();
	});
});

describe('state and PKCE', () => {
	it('generates 43-character base64url values (32 random bytes), never repeating', () => {
		const values = new Set(Array.from({ length: 50 }, () => [generateState(), generateCodeVerifier()]).flat());
		expect(values.size).toBe(100);
		for (const v of values) expect(v).toMatch(/^[A-Za-z0-9_-]{43}$/);
	});

	it('derives the S256 challenge as in RFC 7636 Appendix B', async () => {
		expect(await createS256CodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
			'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
		);
	});
});

describe('createAuthorizationURL', () => {
	it('sets exactly the code-flow parameters, with the challenge and never the verifier or secret', async () => {
		const verifier = generateCodeVerifier();
		const url = await createAuthorizationURL(config, origin, 'state-1', verifier);
		expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
		expect(Object.fromEntries(url.searchParams)).toEqual({
			response_type: 'code',
			client_id: config.clientId,
			redirect_uri: 'https://lethalchess.com/auth/google/callback',
			state: 'state-1',
			scope: 'openid email profile',
			code_challenge_method: 'S256',
			code_challenge: await createS256CodeChallenge(verifier),
			prompt: 'select_account'
		});
		expect(url.toString()).not.toContain(verifier);
		expect(url.toString()).not.toContain(config.clientSecret);
	});
});

describe('exchangeAuthorizationCode', () => {
	const exchange = (respond: () => Promise<Response>) => {
		const fetchFn = vi.fn<typeof fetch>(respond);
		return { fetchFn, result: exchangeAuthorizationCode(config, origin, 'code-1', 'verifier-1', fetchFn) };
	};

	it('POSTs a form to the token endpoint and returns the ID token', async () => {
		const { fetchFn, result } = exchange(async () =>
			Response.json({ access_token: 'at', token_type: 'Bearer', expires_in: 3599, id_token: 'id.tok.en' })
		);
		expect(await result).toEqual({ idToken: 'id.tok.en' });

		const [url, init] = fetchFn.mock.calls[0];
		expect(url).toBe(TOKEN_ENDPOINT);
		expect(TOKEN_ENDPOINT).toBe('https://oauth2.googleapis.com/token');
		expect(init?.method).toBe('POST');
		expect(new Headers(init?.headers).get('content-type')).toBe('application/x-www-form-urlencoded');
		expect(new Headers(init?.headers).has('authorization')).toBe(false);
		expect(init?.signal).toBeInstanceOf(AbortSignal);
		expect(init?.redirect).toBe('manual');
		expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual({
			grant_type: 'authorization_code',
			code: 'code-1',
			redirect_uri: 'https://lethalchess.com/auth/google/callback',
			code_verifier: 'verifier-1',
			client_id: config.clientId,
			client_secret: config.clientSecret
		});
	});

	it.each([
		[400, 'invalid_grant'],
		[401, 'invalid_client']
	])('treats a %i OAuth error as a rejection carrying its code', async (status, code) => {
		const { result } = exchange(async () => Response.json({ error: code, error_description: 'no' }, { status }));
		await expect(result).rejects.toBeInstanceOf(TokenRequestRejected);
		await expect(result).rejects.toMatchObject({ code });
	});

	it('treats a success without an ID token as a rejection', async () => {
		const { result } = exchange(async () => Response.json({ access_token: 'at', token_type: 'Bearer' }));
		await expect(result).rejects.toMatchObject({ code: 'missing_id_token' });
	});

	it.each([
		['a network error', async () => Promise.reject(new TypeError('fetch failed'))],
		['a server error', async () => new Response('oops', { status: 503 })],
		['a 400 without an OAuth error body', async () => new Response('<html>', { status: 400 })],
		['a 200 that is not JSON', async () => new Response('<html>', { status: 200 })],
		['a redirect', async () => new Response(null, { status: 302, headers: { location: 'https://example.com' } })]
	])('reports %s as an endpoint failure', async (_, respond) => {
		await expect(exchange(respond).result).rejects.toBeInstanceOf(TokenEndpointFailure);
	});
});

describe('ID tokens', () => {
	it('decodes a JWT payload and returns null for anything malformed', () => {
		expect(decodeJwtPayload(jwt({ sub: 'x' }))).toEqual({ sub: 'x' });
		for (const bad of ['', 'a.b', 'a.b.c.d', `h.${encodeBase64url(new TextEncoder().encode('[1]'))}.s`, 'h.!!!.s', 'h.bm90IGpzb24.s']) {
			expect(decodeJwtPayload(bad)).toBeNull();
		}
	});

	it('accepts a valid Google identity, including an audience list', () => {
		const now = new Date('2026-09-15T12:00:00.000Z');
		const claims = {
			iss: 'accounts.google.com',
			aud: ['other', config.clientId],
			sub: '42',
			email: 'ann@example.com',
			email_verified: true,
			exp: now.getTime() / 1000 + 60
		};
		expect(parseGoogleIdToken(jwt(claims), config.clientId, now)).toEqual({
			sub: '42',
			email: 'ann@example.com',
			name: 'ann',
			picture: null
		});
		expect(parseGoogleIdToken(jwt({ ...claims, exp: now.getTime() / 1000 }), config.clientId, now)).toBeNull();
	});
});
