import { describe, expect, it } from 'vitest';
import { fetchStatic } from './assets';

describe('fetchStatic', () => {
	it('reads through the ASSETS binding on Cloudflare, with an absolute URL', async () => {
		const seen: string[] = [];
		const event = {
			url: new URL('https://lethalchess.com/openings/ruy-lopez'),
			fetch: async () => new Response('wrong path', { status: 404 }),
			platform: { env: { DB: {} as never, ASSETS: { fetch: async (u: Request | URL | string) => (seen.push(String(u)), new Response('ok')) } } }
		};
		expect(await (await fetchStatic(event as never, '/openings/repertoires/index.json', true)).text()).toBe('ok');
		expect(seen).toEqual(['https://lethalchess.com/openings/repertoires/index.json']);
	});

	it('falls back to the normal fetch under vite dev, where there is no binding', async () => {
		const event = {
			url: new URL('http://localhost:5177/'),
			fetch: async (path: string) => new Response(`dev:${path}`),
			platform: undefined
		};
		expect(await (await fetchStatic(event as never, '/x.json', true)).text()).toBe('dev:/x.json');
	});
});

describe('fetchStatic under vite dev', () => {
	it('ignores an ASSETS binding the dev platform proxy may provide', async () => {
		const event = {
			url: new URL('http://localhost:5177/'),
			fetch: async (path: string) => new Response(`vite:${path}`),
			platform: { env: { DB: {} as never, ASSETS: { fetch: async () => new Response('proxy', { status: 404 }) } } }
		};
		expect(await (await fetchStatic(event as never, '/x.json', false)).text()).toBe('vite:/x.json');
	});
});
