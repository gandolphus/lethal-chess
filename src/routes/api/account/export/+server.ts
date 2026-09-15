import { json } from '@sveltejs/kit';
import { exportAccount } from '$lib/server/account';
import { ApiError, authed } from '$lib/server/http';
import type { RequestHandler } from './$types';

/** Downloads everything stored about the signed-in user as JSON. */
export const GET: RequestHandler = authed(async (_event, { user, db }) => {
	const data = await exportAccount(db, user.id, new Date());
	if (!data) throw new ApiError(404, 'Account not found');
	return json(data, {
		headers: { 'content-disposition': 'attachment; filename="lethal-chess-data.json"' }
	});
});
