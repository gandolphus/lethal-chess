import { json } from '@sveltejs/kit';
import { authed, readJson } from '$lib/server/http';
import { saveCards } from '$lib/server/progress';
import { parseCardEntry, parseList, requireRecord } from '$lib/server/validate';
import type { RequestHandler } from './$types';

const MAX_CARDS = 500;

/** Body `{ cards: { bundleId, epd, state: CardState }[] }` (1–500). Replaces each card's state. */
export const PUT: RequestHandler = authed(async ({ request }, { user, db }) => {
	const body = requireRecord(await readJson(request, 512 * 1024));
	const cards = parseList(body.cards, 'cards', MAX_CARDS, parseCardEntry, 1);
	await saveCards(db, user.id, cards, new Date());
	return json({ saved: cards.length });
});
