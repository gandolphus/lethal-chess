import { error, redirect } from '@sveltejs/kit';
import {
	createAuthorizationURL,
	generateCodeVerifier,
	generateState,
	googleConfig,
	STATE_COOKIE,
	VERIFIER_COOKIE
} from '$lib/server/google';
import type { RequestHandler } from './$types';

const FLOW_COOKIE = { path: '/auth/google', httpOnly: true, sameSite: 'lax', maxAge: 60 * 10 } as const;

export const GET: RequestHandler = async ({ url, cookies, platform }) => {
	const config = googleConfig(platform?.env);
	if (!config) {
		error(503, 'Google sign-in is not configured: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (see .dev.vars.example).');
	}

	const state = generateState();
	const codeVerifier = generateCodeVerifier();
	const authorization = await createAuthorizationURL(config, url.origin, state, codeVerifier);

	cookies.set(STATE_COOKIE, state, FLOW_COOKIE);
	cookies.set(VERIFIER_COOKIE, codeVerifier, FLOW_COOKIE);
	redirect(302, authorization.toString());
};
