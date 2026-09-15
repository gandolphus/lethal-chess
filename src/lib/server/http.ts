import { json, type RequestEvent } from '@sveltejs/kit';
import type { Database } from './db';
import type { User } from './users';
import { InvalidInput } from './validate';

/** Per-user data: never let a shared cache (including the adapter's Cache API layer) keep it. */
export const NO_STORE = { 'cache-control': 'private, no-store' };

export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
	}
}

export const apiError = (status: number, message: string) => json({ error: message }, { status, headers: NO_STORE });

type Context = { user: User; db: Database };

/**
 * Wraps a JSON API handler: requires a signed-in user and a database, and maps thrown
 * ApiError / InvalidInput to JSON error responses. The user always comes from the session,
 * never from the request.
 */
export function authed<E extends RequestEvent>(handler: (event: E, ctx: Context) => Promise<Response>) {
	return async (event: E): Promise<Response> => {
		const user = event.locals.user;
		if (!user) return apiError(401, 'Not signed in');
		const db = event.platform?.env.DB;
		if (!db) return apiError(503, 'Database unavailable');
		try {
			const response = await handler(event, { user, db });
			for (const [key, value] of Object.entries(NO_STORE)) response.headers.set(key, value);
			return response;
		} catch (e) {
			if (e instanceof ApiError) return apiError(e.status, e.message);
			if (e instanceof InvalidInput) return apiError(400, e.message);
			throw e;
		}
	};
}

/**
 * Reads a JSON body. Requiring application/json also means a cross-site page cannot send one
 * without a CORS preflight, which this app never grants.
 */
export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
	const type = request.headers.get('content-type') ?? '';
	if (!/^application\/json\s*(?:;|$)/i.test(type)) throw new ApiError(415, 'Expected application/json');
	const declared = Number(request.headers.get('content-length') ?? 0);
	if (declared > maxBytes) throw new ApiError(413, 'Body too large');
	const text = await request.text();
	if (text.length > maxBytes) throw new ApiError(413, 'Body too large');
	try {
		return JSON.parse(text);
	} catch {
		throw new ApiError(400, 'Malformed JSON');
	}
}
