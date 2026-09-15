import { json } from '@sveltejs/kit';
import { authed, readJson } from '$lib/server/http';
import { importProgress } from '$lib/server/progress';
import { parseAttempt, parseCardEntry, parseDiscovery, parseLineReview, parseList, requireRecord } from '$lib/server/validate';
import type { RequestHandler } from './$types';

const MAX_ATTEMPTS = 20_000;
const MAX_CARDS = 10_000;
const MAX_DISCOVERIES = 10_000;
const MAX_REVIEWS = 20_000;

/**
 * Body `{ attempts: Attempt[], cards: { bundleId, epd, state }[], discoveries?: Discovery[], reviews?: LineReview[] }` — a signed-out learner's
 * browser progress. Safe to repeat: known attempts are skipped and a card only overwrites the
 * account's copy if it was reviewed more recently. Larger histories can be sent in several calls.
 */
export const POST: RequestHandler = authed(async ({ request }, { user, db }) => {
	const body = requireRecord(await readJson(request, 8 * 1024 * 1024));
	const attempts = parseList(body.attempts ?? [], 'attempts', MAX_ATTEMPTS, parseAttempt);
	const cards = parseList(body.cards ?? [], 'cards', MAX_CARDS, parseCardEntry);
	const discoveries = parseList(body.discoveries ?? [], 'discoveries', MAX_DISCOVERIES, parseDiscovery);
	const reviews = parseList(body.reviews ?? [], 'reviews', MAX_REVIEWS, parseLineReview);
	const result = await importProgress(db, user.id, { attempts, cards, discoveries, reviews }, new Date());
	return json({ importedAttempts: result.attempts, cards: cards.length });
});
