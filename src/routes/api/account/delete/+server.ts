import { json } from '@sveltejs/kit';
import { deleteAccount } from '$lib/server/account';
import { ApiError, authed, readJson } from '$lib/server/http';
import { deleteSessionCookie } from '$lib/server/session';
import type { RequestHandler } from './$types';

/**
 * Permanently deletes the signed-in user's account and all their progress. The body must be
 * `{ "confirm": "delete my account" }` — a deliberate phrase, so no stray request can do this.
 */
export const POST: RequestHandler = authed(async ({ request, cookies }, { user, db }) => {
	const body = (await readJson(request, 1024)) as { confirm?: unknown } | null;
	if (body?.confirm !== 'delete my account') throw new ApiError(400, 'Confirmation phrase missing');
	await deleteAccount(db, user.id);
	deleteSessionCookie(cookies);
	return json({ deleted: true });
});
