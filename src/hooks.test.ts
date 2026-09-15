import { describe, expect, it } from 'vitest';
import { handle } from './hooks.server';
import { fakeEvent } from '$lib/server/test-event';

const resolve = async () => new Response('page');

describe('handle', () => {
	it('permanently redirects www to the canonical host, keeping path and query', async () => {
		const event = fakeEvent({ url: 'https://www.lethalchess.com/openings/ruy-lopez?theme=night' });
		event.url = new URL('https://www.lethalchess.com/openings/ruy-lopez?theme=night');
		const response = await handle({ event: event as never, resolve });
		expect(response.status).toBe(301);
		expect(response.headers.get('location')).toBe('https://lethalchess.com/openings/ruy-lopez?theme=night');
	});

	it('serves the canonical host normally', async () => {
		const event = fakeEvent({});
		event.url = new URL('https://lethalchess.com/');
		const response = await handle({ event: event as never, resolve });
		expect(await response.text()).toBe('page');
	});
});
