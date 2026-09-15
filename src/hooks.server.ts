import type { Handle } from '@sveltejs/kit';
import { deleteSessionCookie, SESSION_COOKIE, setSessionCookie, validateSessionToken } from '$lib/server/session';

/** The canonical host; `www.` is attached to the Worker only so it can redirect here. */
const CANONICAL_HOST = 'lethalchess.com';

export const handle: Handle = async ({ event, resolve }) => {
	// Permanent redirect before anything else: sessions and the Google callback live on one host.
	if (event.url.hostname === `www.${CANONICAL_HOST}`) {
		const target = new URL(event.url);
		target.hostname = CANONICAL_HOST;
		return new Response(null, { status: 301, headers: { location: target.toString() } });
	}

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
