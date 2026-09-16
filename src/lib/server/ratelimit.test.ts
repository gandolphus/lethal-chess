import { describe, expect, it } from 'vitest';
import { authed } from './http';

const ok = authed(async () => new Response('ok', { status: 200 }));

const event = (limiter?: { limit: (o: { key: string }) => Promise<{ success: boolean }> }) =>
	({
		locals: { user: { id: 'u1', email: 'a@b.c', name: 'A', picture: null } },
		platform: { env: { DB: {} as never, ...(limiter ? { API_LIMIT: limiter } : {}) } }
	}) as never;

describe('the write API rate limit', () => {
	it('answers 429 when the account is over its budget, and says so', async () => {
		const response = await ok(event({ limit: async () => ({ success: false }) }));
		expect(response.status).toBe(429);
		expect(await response.json()).toMatchObject({ error: expect.stringContaining('Too many requests') });
	});

	it('keys the budget on the account, never the address', async () => {
		const seen: string[] = [];
		await ok(event({ limit: async ({ key }) => (seen.push(key), { success: true }) }));
		expect(seen).toEqual(['u1']);
	});

	it('lets the request through where there is no limiter, as in dev and tests', async () => {
		expect((await ok(event())).status).toBe(200);
	});
});
