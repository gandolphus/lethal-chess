import { describe, expect, it } from 'vitest';
import { readJson } from './http';

const streamed = (text: string, chunks = 4) => {
	const bytes = new TextEncoder().encode(text);
	const size = Math.ceil(bytes.length / chunks);
	return new Request('https://lethalchess.com/api', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: new ReadableStream({
			start(controller) {
				for (let i = 0; i < bytes.length; i += size) controller.enqueue(bytes.slice(i, i + size));
				controller.close();
			}
		}),
		duplex: 'half'
	} as RequestInit);
};

describe('readJson', () => {
	it('parses a body sent without Content-Length', async () => {
		expect(await readJson(streamed(JSON.stringify({ ok: 'å' })), 1024)).toEqual({ ok: 'å' });
	});

	it('stops reading a body without Content-Length once it passes the cap', async () => {
		await expect(readJson(streamed(JSON.stringify({ pad: 'x'.repeat(5000) })), 1024)).rejects.toMatchObject({ status: 413 });
	});
});
