import { json } from '@sveltejs/kit';
import { authed, readJson } from '$lib/server/http';
import { recordAttempts } from '$lib/server/progress';
import { parseAttempt, parseList, requireRecord } from '$lib/server/validate';
import type { RequestHandler } from './$types';

const MAX_ATTEMPTS = 500;

/** Body `{ attempts: Attempt[] }` (1–500). Idempotent: re-sent attempts are skipped. */
export const POST: RequestHandler = authed(async ({ request }, { user, db }) => {
	const body = requireRecord(await readJson(request, 256 * 1024));
	const attempts = parseList(body.attempts, 'attempts', MAX_ATTEMPTS, parseAttempt, 1);
	const inserted = await recordAttempts(db, user.id, attempts, new Date());
	return json({ inserted });
});
