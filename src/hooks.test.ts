import { describe, expect, it } from 'vitest';
import { handle, SECURITY_HEADERS } from './hooks.server';
import { fakeEvent } from '$lib/server/test-event';

const resolve = async () => new Response('page');

function eventFor(url: string) {
	const event = fakeEvent({});
	event.url = new URL(url);
	return event as never;
}

describe('handle', () => {
	it('permanently redirects www to the canonical host, keeping path and query', async () => {
		const response = await handle({ event: eventFor('https://www.lethalchess.com/openings/ruy-lopez?theme=night'), resolve });
		expect(response.status).toBe(301);
		expect(response.headers.get('location')).toBe('https://lethalchess.com/openings/ruy-lopez?theme=night');
	});

	it('upgrades plain HTTP to HTTPS, including http://www in one hop', async () => {
		const apex = await handle({ event: eventFor('http://lethalchess.com/privacy'), resolve });
		expect(apex.status).toBe(301);
		expect(apex.headers.get('location')).toBe('https://lethalchess.com/privacy');

		const www = await handle({ event: eventFor('http://www.lethalchess.com/'), resolve });
		expect(www.headers.get('location')).toBe('https://lethalchess.com/');
	});

	it('serves the canonical host with every security header', async () => {
		const response = await handle({ event: eventFor('https://lethalchess.com/'), resolve });
		expect(await response.text()).toBe('page');
		for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(response.headers.get(name)).toBe(value);
	});

	it('makes browsers revalidate pages, without touching responses that set their own caching', async () => {
		const page = await handle({
			event: eventFor('https://lethalchess.com/'),
			resolve: async () => new Response('<html>', { headers: { 'content-type': 'text/html; charset=utf-8' } })
		});
		expect(page.headers.get('cache-control')).toBe('no-cache');

		const api = await handle({
			event: eventFor('https://lethalchess.com/api/progress/x'),
			resolve: async () => new Response('{}', { headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' } })
		});
		expect(api.headers.get('cache-control')).toBe('private, no-store');
	});

	it('leaves local development on plain HTTP alone, without HSTS', async () => {
		const response = await handle({ event: eventFor('http://localhost:5177/'), resolve });
		expect(await response.text()).toBe('page');
		expect(response.headers.get('strict-transport-security')).toBeNull();
		expect(response.headers.get('x-frame-options')).toBe('DENY');
	});
});
