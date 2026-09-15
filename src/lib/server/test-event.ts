// Test-only: minimal stand-ins for SvelteKit's RequestEvent and Cookies.
import type { Cookies } from '@sveltejs/kit';
import type { Database } from './db';
import type { Session } from './session';
import type { User } from './users';

type CookieOptions = Parameters<Cookies['set']>[2];

export class FakeCookies implements Cookies {
	jar = new Map<string, { value: string; options: CookieOptions }>();
	deleted = new Set<string>();

	constructor(initial: Record<string, string> = {}) {
		for (const [name, value] of Object.entries(initial)) this.jar.set(name, { value, options: { path: '/' } });
	}

	get(name: string) {
		return this.jar.get(name)?.value;
	}

	getAll() {
		return [...this.jar].map(([name, { value }]) => ({ name, value }));
	}

	set(name: string, value: string, options: CookieOptions) {
		this.jar.set(name, { value, options });
		this.deleted.delete(name);
	}

	delete(name: string) {
		this.jar.delete(name);
		this.deleted.add(name);
	}

	serialize(name: string, value: string) {
		return `${name}=${value}`;
	}
}

export type EventInit = {
	url?: string;
	method?: string;
	body?: unknown;
	headers?: Record<string, string>;
	cookies?: Record<string, string>;
	params?: Record<string, string>;
	db?: Database;
	env?: Record<string, string>;
	user?: User | null;
	session?: Session | null;
};

export function fakeEvent(init: EventInit = {}) {
	const url = new URL(init.url ?? '/', 'http://localhost:5177');
	const headers = new Headers(init.headers);
	let body: string | undefined;
	if (init.body !== undefined) {
		body = typeof init.body === 'string' ? init.body : JSON.stringify(init.body);
		if (!headers.has('content-type')) headers.set('content-type', 'application/json');
	}
	return {
		url,
		request: new Request(url, { method: init.method ?? 'GET', headers, body }),
		cookies: new FakeCookies(init.cookies),
		params: init.params ?? {},
		locals: { user: init.user ?? null, session: init.session ?? null },
		platform: init.db ? { env: { DB: init.db, ...init.env } } : undefined
	};
}

/** Calls a route handler with a fake event; SvelteKit's thrown redirects/errors are returned, not thrown. */
export async function call(handler: (event: never) => unknown, event: ReturnType<typeof fakeEvent>): Promise<unknown> {
	try {
		return await handler(event as never);
	} catch (e) {
		return e;
	}
}
