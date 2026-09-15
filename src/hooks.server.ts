import type { Handle } from '@sveltejs/kit';
import { deleteSessionCookie, SESSION_COOKIE, setSessionCookie, validateSessionToken } from '$lib/server/session';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	event.locals.session = null;

	// Only touch the database when there is a cookie: prerendering has no platform.env.
	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		const db = event.platform?.env.DB;
		const result = db ? await validateSessionToken(db, token, new Date()) : null;
		if (result) {
			event.locals.user = result.user;
			event.locals.session = result.session;
			if (result.renewed) setSessionCookie(event.cookies, token, result.session.expiresAt);
		} else if (db) {
			deleteSessionCookie(event.cookies);
		}
	}

	const response = await resolve(event);

	// Every page carries the signed-in user through the root layout, so a response rendered
	// for a session must never land in a shared cache.
	if (event.locals.user && !/\b(?:private|no-store)\b/.test(response.headers.get('cache-control') ?? '')) {
		response.headers.set('cache-control', 'private, no-store');
	}
	return response;
};
