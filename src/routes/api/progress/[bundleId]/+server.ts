import { json } from '@sveltejs/kit';
import { authed } from '$lib/server/http';
import { loadProgress } from '$lib/server/progress';
import { parseBundleId } from '$lib/server/validate';
import type { RequestHandler } from './$types';

/** The signed-in user's cards (`{ [epd]: CardState }`, dates as ISO strings) and attempts, oldest first. */
export const GET: RequestHandler = authed(async ({ params }, { user, db }) =>
	json(await loadProgress(db, user.id, parseBundleId(params.bundleId)))
);
