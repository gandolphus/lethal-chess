import type { Handle } from '@sveltejs/kit';
import { version } from '$app/environment';
import { deleteSessionCookie, SESSION_COOKIE, setSessionCookie, validateSessionToken } from '$lib/server/session';

/** The canonical host; `www.` is attached to the Worker only so it can redirect here. */
const CANONICAL_HOST = 'lethalchess.com';

/**
 * Applied to every response the Worker renders. Static files get the same set from
 * `static/_headers`. The CSP itself is configured through SvelteKit (vite.config.ts) so it can
 * hash SvelteKit's own inline bootstrap script.
 */
export const SECURITY_HEADERS: Record<string, string> = {
	// Six months, this host only. includeSubDomains/preload can follow once every subdomain is HTTPS.
	'strict-transport-security': 'max-age=15552000',
	'x-frame-options': 'DENY',
	'x-content-type-options': 'nosniff',
	'referrer-policy': 'strict-origin-when-cross-origin',
	'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
};

/** The site token is public by design: it only identifies which site the visit counts toward. */
export const ANALYTICS_BEACON =
	`<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "a5b618f62bf44df98c7ef4cc4b71ff0c"}'></script>`;

/** SvelteKit's default version is the build's timestamp; the badge shows it so a phone can tell which build it has. */
const BUILT = new Date(Number(version)).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', dateStyle: 'short', timeStyle: 'short' });

/** Shown on every page of the staging deploy, so it is never mistaken for the real site. */
const STAGING_BADGE =
	`<div style="position:fixed;bottom:calc(4px + env(safe-area-inset-bottom));left:4px;z-index:2147483647;padding:1px 6px;border-radius:5px;opacity:.85;background:#f38ba8;color:#11111b;font:700 9px/1.4 system-ui,sans-serif;letter-spacing:.08em;pointer-events:none">STAGING · ${BUILT}</div>`;

const isLocal =(hostname: string) => hostname === 'localhost' || hostname === '127.0.0.1';

export const handle: Handle = async ({ event, resolve }) => {
	const { url } = event;
	// Plain HTTP and www both redirect permanently to https://lethalchess.com, before anything else:
	// sessions, Secure cookies and the Google callback only work on the canonical HTTPS origin.
	if (!isLocal(url.hostname) && (url.protocol === 'http:' || url.hostname === `www.${CANONICAL_HOST}`)) {
		const target = new URL(url);
		target.protocol = 'https:';
		if (target.hostname === `www.${CANONICAL_HOST}`) target.hostname = CANONICAL_HOST;
		return new Response(null, { status: 301, headers: { location: target.toString(), ...SECURITY_HEADERS } });
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

	// Cloudflare Web Analytics: cookieless visit counts, production only, so local testing never counts.
	const staging = Boolean(event.platform?.env.STAGING);
	const response = await resolve(event, {
		transformPageChunk: ({ html }) => {
			if (url.hostname === CANONICAL_HOST) return html.replace('</head>', `${ANALYTICS_BEACON}</head>`);
			if (staging) return html.replace('</body>', `${STAGING_BADGE}</body>`);
			return html;
		}
	});
	// Staging sits behind Cloudflare Access already; this keeps it out of search results regardless.
	if (staging) response.headers.set('x-robots-tag', 'noindex, nofollow');

	// Every page carries the signed-in user through the root layout, so a response rendered
	// for a session must never land in a shared cache.
	if (event.locals.user && !/\b(?:private|no-store)\b/.test(response.headers.get('cache-control') ?? '')) {
		response.headers.set('cache-control', 'private, no-store');
	}
	// Pages must be revalidated on every visit (cheap: the ETag makes it a 304), so a browser never
	// keeps serving an old page that points at an old build. Hashed /_app/immutable assets are cached
	// forever by the assets layer, which is correct because their names change with every build.
	if (!response.headers.has('cache-control') && (response.headers.get('content-type') ?? '').startsWith('text/html')) {
		response.headers.set('cache-control', 'no-cache');
	}
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		if (name === 'strict-transport-security' && isLocal(url.hostname)) continue;
		response.headers.set(name, value);
	}
	return response;
};
