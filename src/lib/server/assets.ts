import { dev } from '$app/environment';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Fetches a file from `static/` during server rendering. On Cloudflare, static files are
 * served by the assets layer in front of the Worker, so SvelteKit's own server-side `fetch`
 * of such a path returns 404 from inside the Worker; the ASSETS binding reaches them
 * directly. Under `vite dev`, Vite serves `static/` and the platform proxy's ASSETS binding
 * does not, so the normal fetch is used there.
 */
export function fetchStatic(
	event: Pick<RequestEvent, 'fetch' | 'url' | 'platform'>,
	path: string,
	useAssetsBinding = !dev
): Promise<Response> {
	const assets = useAssetsBinding ? event.platform?.env.ASSETS : undefined;
	return assets ? assets.fetch(new URL(path, event.url.origin)) : event.fetch(path);
}
