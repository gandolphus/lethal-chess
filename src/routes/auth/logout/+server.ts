import { redirect } from '@sveltejs/kit';
import { deleteSessionCookie, invalidateSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

// POST only, so a link or image cannot sign anyone out. SvelteKit's origin check covers form posts.
export const POST: RequestHandler = async ({ locals, platform, cookies }) => {
	const db = platform?.env.DB;
	if (locals.session && db) await invalidateSession(db, locals.session.id);
	deleteSessionCookie(cookies);
	redirect(303, '/');
};
