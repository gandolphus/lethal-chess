/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/*
 * Makes the site installable and repeat loads fast. It never serves a page: navigations always go
 * to the network, so a deploy can't hide behind a cached copy ([[Decision Log]] 2026-09-16).
 * SvelteKit registers it in production builds only.
 */
import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

/** One cache per build; activating a new build throws the previous one away. */
const CACHE = `lethal-${version}`;

/** Hashed by the build, so a cached copy is the right one for as long as this build lives. */
const IMMUTABLE = '/_app/immutable/';

/** Stockfish: 7 MB, and its file names don't change between releases. See `carryOverEngine`. */
const ENGINE = '/engine/';

/**
 * Fetched before they're needed: the build, what the home screen and tab bar show, and the script that
 * dresses the page in its theme — that one blocks the first paint, so leaving it to the network would
 * make every installed load wait, and an offline load flash the default palette.
 */
const PRECACHE = [
	...build,
	...files.filter(
		(f) => f.startsWith('/icons/') || f.startsWith('/favicon') || f === '/manifest.webmanifest' || f === '/theme.js'
	)
];

/** The only paths the worker keeps a copy of. Nothing personal lives under them. */
const CACHEABLE = [IMMUTABLE, ENGINE, '/icons/', '/favicon', '/manifest.webmanifest', '/theme.js', '/openings/repertoires/'];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(PRECACHE))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			for (const name of await caches.keys()) {
				if (name === CACHE) continue;
				await carryOverEngine(await caches.open(name), cache);
				await caches.delete(name);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	// Pages are the browser's business: the network, every time, so a deploy shows at once.
	if (request.mode === 'navigate' || request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== sw.location.origin || request.headers.has('authorization')) return;
	// Page data can be personal; the API always is.
	if (url.pathname.endsWith('/__data.json') || !CACHEABLE.some((prefix) => url.pathname.startsWith(prefix))) return;

	const cacheFirst = url.pathname.startsWith(IMMUTABLE) || url.pathname.startsWith(ENGINE);
	event.respondWith(cacheFirst ? fromCache(request) : fromNetwork(request));
});

/** Hashed assets and the engine: the cache, then the network once. */
async function fromCache(request: Request) {
	const cache = await caches.open(CACHE);
	const cached = await cache.match(request);
	if (cached) return cached;
	const response = await fetch(request);
	if (storable(response)) void cache.put(request, response.clone());
	return response;
}

/** Everything else: the network, with the last copy for when there is none. */
async function fromNetwork(request: Request) {
	const cache = await caches.open(CACHE);
	try {
		const response = await fetch(request);
		if (storable(response)) void cache.put(request, response.clone());
		return response;
	} catch (error) {
		return (await cache.match(request)) ?? Promise.reject(error);
	}
}

/** Complete, public, same-origin responses only. Signed-in pages carry `private, no-store` and never land here. */
function storable(response: Response) {
	return response.ok && response.type === 'basic' && !/\b(?:private|no-store)\b/.test(response.headers.get('cache-control') ?? '');
}

/**
 * The engine's file names never change, so a cached copy could outlive an engine upgrade. Before an
 * old build's cache goes, each engine file moves to the new one only if the server still has the same
 * ETag: a HEAD request per file, instead of 7 MB, on every deploy that didn't touch Stockfish.
 */
async function carryOverEngine(from: Cache, to: Cache) {
	for (const request of await from.keys()) {
		if (!new URL(request.url).pathname.startsWith(ENGINE)) continue;
		const cached = await from.match(request);
		const etag = cached?.headers.get('etag');
		if (!cached || !etag) continue;
		try {
			const head = await fetch(request.url, { method: 'HEAD', cache: 'no-store' });
			if (head.ok && head.headers.get('etag') === etag) await to.put(request, cached);
		} catch {
			// Offline: the next build fetches the engine when it's next asked for.
		}
	}
}
