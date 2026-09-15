import { json } from '@sveltejs/kit';
import { authed, readJson } from '$lib/server/http';
import { importProgress } from '$lib/server/progress';
import { parseAttempt, parseCardEntry, parseList, requireRecord } from '$lib/server/validate';
import type { RequestHandler } from './$types';

const MAX_ATTEMPTS = 20_000;
const MAX_CARDS = 10_000;

/**
 * Body `{ attempts: Attempt[], cards: { bundleId, epd, state }[] }` — a signed-out learner's
 * browser progress. Safe to repeat: known attempts are skipped and a card only overwrites the
 * account's copy if it was reviewed more recently. Larger histories can be sent in several calls.
 */
export const POST: RequestHandler = authed(async ({ request }, { user, db }) => {
	const body = requireRecord(await readJson(request, 8 * 1024 * 1024));
	const attempts = parseList(body.attempts ?? [], 'attempts', MAX_ATTEMPTS, parseAttempt);
	const cards = parseList(body.cards ?? [], 'cards', MAX_CARDS, parseCardEntry);
	const result = await importProgress(db, user.id, { attempts, cards }, new Date());
	return json({ importedAttempts: result.attempts, cards: cards.length });
});
