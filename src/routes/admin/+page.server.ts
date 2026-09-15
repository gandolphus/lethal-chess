import { error } from '@sveltejs/kit';
import { isAdmin, siteStats } from '$lib/server/stats';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform, setHeaders }) => {
	// Anyone who isn't the admin gets a plain 404, so the page's existence isn't advertised.
	if (!isAdmin(locals.user)) error(404, 'Not found');
	const db = platform?.env.DB;
	if (!db) error(503, 'Database unavailable');
	setHeaders({ 'cache-control': 'private, no-store' });
	return { stats: await siteStats(db, new Date()) };
};
