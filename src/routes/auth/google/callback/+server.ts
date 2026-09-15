import { error, redirect } from '@sveltejs/kit';
import {
	exchangeAuthorizationCode,
	googleConfig,
	parseGoogleIdToken,
	STATE_COOKIE,
	TokenRequestRejected,
	VERIFIER_COOKIE
} from '$lib/server/google';
import { createSession, generateSessionToken, invalidateSession, setSessionCookie } from '$lib/server/session';
import { upsertGoogleUser } from '$lib/server/users';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies, platform, locals }) => {
	const config = googleConfig(platform?.env);
	const db = platform?.env.DB;
	if (!config || !db) error(503, 'Google sign-in is not configured.');

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const storedState = cookies.get(STATE_COOKIE);
	const codeVerifier = cookies.get(VERIFIER_COOKIE);
	// One-shot: whatever happens next, this flow's state and verifier are spent.
	cookies.delete(STATE_COOKIE, { path: '/auth/google' });
	cookies.delete(VERIFIER_COOKIE, { path: '/auth/google' });

	if (url.searchParams.has('error')) redirect(302, '/?signin=cancelled');
	if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
		error(400, 'Sign-in could not be verified. Please try again.');
	}

	let idToken: string;
	try {
		({ idToken } = await exchangeAuthorizationCode(config, url.origin, code, codeVerifier));
	} catch (e) {
		if (e instanceof TokenRequestRejected) error(400, 'Google rejected the sign-in. Please try again.');
		error(502, 'Could not reach Google. Please try again.');
	}
	const now = new Date();
	const claims = parseGoogleIdToken(idToken, config.clientId, now);
	if (!claims) error(400, 'Google returned an identity we cannot accept.');

	const user = await upsertGoogleUser(db, claims, now);
	if (locals.session) await invalidateSession(db, locals.session.id);
	const token = generateSessionToken();
	const session = await createSession(db, token, user.id, now);
	setSessionCookie(cookies, token, session.expiresAt);
	redirect(302, '/');
};
