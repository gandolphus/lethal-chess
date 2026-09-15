// Google OAuth 2.0 / OpenID Connect: authorization code flow with PKCE (S256) and state,
// written with fetch and Web Crypto only.
// Based on the example code in github.com/pilcrowonpaper/arctic under /code
// (authorization_request-pkce.ts, authorization_code_exchange-pkce.ts; 0BSD, by pilcrowonpaper),
// which the author recommends in place of the Arctic package (pilcrowonpaper.com/blog/18).
// Differences: state is added, client credentials go only in the body (RFC 6749 §2.3 allows one
// method per request), and failures are classified for the callback route.
import { decodeBase64url, encodeBase64url, randomBase64url } from './encoding';
import type { GoogleClaims } from './users';

export const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const CALLBACK_PATH = '/auth/google/callback';
export const STATE_COOKIE = 'google_oauth_state';
export const VERIFIER_COOKIE = 'google_code_verifier';
export const SCOPES = ['openid', 'email', 'profile'];
const TOKEN_TIMEOUT_MS = 10_000;

export type GoogleEnv = { GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string };
export type GoogleConfig = { clientId: string; clientSecret: string };

export function googleConfig(env: GoogleEnv | undefined): GoogleConfig | null {
	const clientId = env?.GOOGLE_CLIENT_ID?.trim();
	const clientSecret = env?.GOOGLE_CLIENT_SECRET?.trim();
	return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** Derived from the request origin; Google only accepts redirect URIs registered for the client. */
export const redirectUri = (origin: string) => new URL(CALLBACK_PATH, origin).toString();

/** 32 random bytes, base64url: 256 bits of entropy. */
export const generateState = () => randomBase64url(32);

/** 32 random bytes, base64url: a 43-character verifier, the RFC 7636 minimum length. */
export const generateCodeVerifier = () => randomBase64url(32);

/** RFC 7636 §4.2: BASE64URL(SHA256(ASCII(code_verifier))), unpadded. */
export async function createS256CodeChallenge(codeVerifier: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
	return encodeBase64url(new Uint8Array(digest));
}

export async function createAuthorizationURL(
	config: GoogleConfig,
	origin: string,
	state: string,
	codeVerifier: string
): Promise<URL> {
	const url = new URL(AUTHORIZATION_ENDPOINT);
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('client_id', config.clientId);
	url.searchParams.set('redirect_uri', redirectUri(origin));
	url.searchParams.set('state', state);
	url.searchParams.set('scope', SCOPES.join(' '));
	url.searchParams.set('code_challenge_method', 'S256');
	url.searchParams.set('code_challenge', await createS256CodeChallenge(codeVerifier));
	url.searchParams.set('prompt', 'select_account');
	return url;
}

/** Google answered and refused the exchange (bad or reused code, verifier mismatch, bad client). */
export class TokenRequestRejected extends Error {
	constructor(readonly code: string) {
		super(`Token request rejected: ${code}`);
	}
}

/** Google could not be reached or answered with something other than a token or an OAuth error. */
export class TokenEndpointFailure extends Error {}

/**
 * Exchanges the authorization code for tokens and returns the ID token. Because it comes straight
 * from Google's token endpoint over TLS, its signature need not be checked (OIDC Core 3.1.3.7),
 * but its claims must be — see parseGoogleIdToken.
 */
export async function exchangeAuthorizationCode(
	config: GoogleConfig,
	origin: string,
	code: string,
	codeVerifier: string,
	fetchFn: typeof fetch = fetch
): Promise<{ idToken: string }> {
	const body = new URLSearchParams({
		grant_type: 'authorization_code',
		code,
		redirect_uri: redirectUri(origin),
		code_verifier: codeVerifier,
		client_id: config.clientId,
		client_secret: config.clientSecret
	});

	let response: Response;
	try {
		response = await fetchFn(TOKEN_ENDPOINT, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
			body,
			// Never re-send the client secret to wherever a redirect points.
			redirect: 'manual',
			signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS)
		});
	} catch (e) {
		throw new TokenEndpointFailure('Token endpoint unreachable', { cause: e });
	}

	const data: unknown = await response.json().catch(() => null);
	const field = (name: string) =>
		typeof data === 'object' && data !== null && typeof (data as Record<string, unknown>)[name] === 'string'
			? ((data as Record<string, unknown>)[name] as string)
			: null;

	if (response.status === 400 || response.status === 401) {
		const error = field('error');
		if (error) throw new TokenRequestRejected(error);
		throw new TokenEndpointFailure(`Unexpected ${response.status} response from token endpoint`);
	}
	if (response.status !== 200) throw new TokenEndpointFailure(`Unexpected ${response.status} response from token endpoint`);

	if (typeof data !== 'object' || data === null) throw new TokenEndpointFailure('Token endpoint returned no JSON object');
	const idToken = field('id_token');
	if (!idToken) throw new TokenRequestRejected('missing_id_token');
	return { idToken };
}

/** Decodes a JWT's payload without verifying it. Null if it is not a well-formed JWT with a JSON object payload. */
export function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
	const parts = jwt.split('.');
	if (parts.length !== 3) return null;
	try {
		const payload: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decodeBase64url(parts[1])));
		return typeof payload === 'object' && payload !== null && !Array.isArray(payload)
			? (payload as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

/**
 * Checks the claims of an ID token received from exchangeAuthorizationCode: issuer, audience,
 * expiry, subject and a verified email. Returns null for anything unacceptable.
 */
export function parseGoogleIdToken(idToken: string, clientId: string, now: Date): GoogleClaims | null {
	const claims = decodeJwtPayload(idToken);
	if (!claims) return null;

	const { iss, aud, exp, sub, email, email_verified, name, picture } = claims;
	const audiences = Array.isArray(aud) ? aud : [aud];
	if (typeof iss !== 'string' || !ISSUERS.has(iss)) return null;
	if (!audiences.includes(clientId)) return null;
	if (typeof exp !== 'number' || exp * 1000 <= now.getTime()) return null;
	if (typeof sub !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(sub)) return null;
	if (typeof email !== 'string' || email.length > 320 || !email.includes('@')) return null;
	if (email_verified !== true) return null;

	const displayName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 200) : email.split('@')[0];
	const pictureUrl = typeof picture === 'string' && /^https:\/\//.test(picture) && picture.length <= 2048 ? picture : null;
	return { sub, email, name: displayName, picture: pictureUrl };
}
