import type { Attempt } from '$lib/drill/session.svelte';
import type { Discovery } from '$lib/explore/book';
import type { LineReview } from '$lib/explore/mastery';
import type { Database, Statement } from './db';
import { assertWithinQuota } from './quota';
import type { CardEntry, CardJson } from './validate';

// Rows go in as one JSON array parameter per statement, unpacked with json_each: D1 caps bound
// parameters at 100 per statement, and one statement per chunk keeps an import to a single
// round trip (db.batch is one transaction). Chunks stay well under D1's 2 MB value limit.
const CHUNK = 500;

const chunks = <T>(items: T[]) =>
	Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) => items.slice(i * CHUNK, (i + 1) * CHUNK));

const changes = (results: unknown[]) =>
	results.reduce<number>((sum, r) => sum + ((r as { meta?: { changes?: number } }).meta?.changes ?? 0), 0);

const INSERT_ATTEMPTS = `
	INSERT INTO attempts (user_id, bundle_id, epd, mode, played, expected, grade, cost_cp, attempt_no, response_ms, at, created_at)
	SELECT ?1,
		json_extract(value, '$.bundleId'), json_extract(value, '$.epd'), json_extract(value, '$.mode'),
		json_extract(value, '$.played'), json_extract(value, '$.expected'), json_extract(value, '$.grade'),
		json_extract(value, '$.costCp'), json_extract(value, '$.attemptNo'), json_extract(value, '$.responseMs'),
		json_extract(value, '$.at'), ?2
	FROM json_each(?3) WHERE true
	ON CONFLICT DO NOTHING`;

const upsertCards = (newerOnly: boolean) => `
	INSERT INTO cards (user_id, bundle_id, epd, state, updated_at)
	SELECT ?1, json_extract(value, '$.bundleId'), json_extract(value, '$.epd'), json_extract(value, '$.state'), ?2
	FROM json_each(?3) WHERE true
	ON CONFLICT (user_id, bundle_id, epd) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at
	${
		newerOnly
			? `WHERE json_extract(cards.state, '$.last_review') IS NULL
			   OR json_extract(excluded.state, '$.last_review') > json_extract(cards.state, '$.last_review')`
			: ''
	}`;

// A stage reached once stays reached: re-sent discoveries are no-ops.
const INSERT_DISCOVERIES = `
	INSERT INTO discoveries (user_id, bundle_id, line, stage, at, created_at)
	SELECT ?1, json_extract(value, '$.bundleId'), json_extract(value, '$.line'), json_extract(value, '$.stage'),
		json_extract(value, '$.at'), ?2
	FROM json_each(?3) WHERE true
	ON CONFLICT DO NOTHING`;

function discoveryStatements(db: Database, userId: string, discoveries: Discovery[], now: Date): Statement[] {
	return chunks(discoveries).map((chunk) =>
		db.prepare(INSERT_DISCOVERIES).bind(userId, now.getTime(), JSON.stringify(chunk))
	);
}

const INSERT_REVIEWS = `
	INSERT INTO line_reviews (user_id, bundle_id, line, rating, at, created_at)
	SELECT ?1, json_extract(value, '$.bundleId'), json_extract(value, '$.line'), json_extract(value, '$.rating'),
		json_extract(value, '$.at'), ?2
	FROM json_each(?3) WHERE true
	ON CONFLICT DO NOTHING`;

function reviewStatements(db: Database, userId: string, reviews: LineReview[], now: Date): Statement[] {
	return chunks(reviews).map((chunk) => db.prepare(INSERT_REVIEWS).bind(userId, now.getTime(), JSON.stringify(chunk)));
}

function attemptStatements(db: Database, userId: string, attempts: Attempt[], now: Date): Statement[] {
	return chunks(attempts).map((chunk) =>
		db.prepare(INSERT_ATTEMPTS).bind(userId, now.getTime(), JSON.stringify(chunk))
	);
}

function cardStatements(db: Database, userId: string, cards: CardEntry[], now: Date, newerOnly: boolean): Statement[] {
	return chunks(cards).map((chunk) =>
		db.prepare(upsertCards(newerOnly)).bind(userId, now.getTime(), JSON.stringify(chunk))
	);
}

/** Appends attempts; ones already recorded (same natural key) are skipped. Returns how many were new. */
export async function recordAttempts(db: Database, userId: string, attempts: Attempt[], now: Date): Promise<number> {
	if (!attempts.length) return 0;
	await assertWithinQuota(db, userId, attempts.length);
	return changes(await db.batch(attemptStatements(db, userId, attempts, now)));
}

/** Last write wins: the client that just reviewed the card is authoritative. */
export async function saveCards(db: Database, userId: string, cards: CardEntry[], now: Date): Promise<void> {
	if (!cards.length) return;
	await assertWithinQuota(db, userId, cards.length);
	await db.batch(cardStatements(db, userId, cards, now, false));
}

/**
 * Merges a signed-out learner's local progress into their account, atomically and idempotently:
 * duplicate attempts are skipped, and a local card only replaces the account's copy when it was
 * reviewed more recently.
 */
export async function importProgress(
	db: Database,
	userId: string,
	data: { attempts: Attempt[]; cards: CardEntry[]; discoveries?: Discovery[]; reviews?: LineReview[] },
	now: Date
): Promise<{ attempts: number }> {
	const adding = data.attempts.length + data.cards.length + (data.discoveries?.length ?? 0) + (data.reviews?.length ?? 0);
	await assertWithinQuota(db, userId, adding);
	const attempts = attemptStatements(db, userId, data.attempts, now);
	const statements = [
		...attempts,
		...cardStatements(db, userId, data.cards, now, true),
		...discoveryStatements(db, userId, data.discoveries ?? [], now),
		...reviewStatements(db, userId, data.reviews ?? [], now)
	];
	if (!statements.length) return { attempts: 0 };
	const results = await db.batch(statements);
	return { attempts: changes(results.slice(0, attempts.length)) };
}

type AttemptRow = {
	bundle_id: string;
	epd: string;
	mode: Attempt['mode'];
	played: string;
	expected: string;
	grade: Attempt['grade'];
	cost_cp: number | null;
	attempt_no: number;
	response_ms: number;
	at: string;
};

export async function loadProgress(
	db: Database,
	userId: string,
	bundleId: string
): Promise<{ cards: Record<string, CardJson>; attempts: Attempt[]; discoveries: Discovery[]; reviews: LineReview[] }> {
	const [cards, attempts, discoveries, reviews] = await db.batch([
		db.prepare('SELECT epd, state FROM cards WHERE user_id = ? AND bundle_id = ?').bind(userId, bundleId),
		db
			.prepare(
				`SELECT bundle_id, epd, mode, played, expected, grade, cost_cp, attempt_no, response_ms, at
				 FROM attempts WHERE user_id = ? AND bundle_id = ? ORDER BY at, id`
			)
			.bind(userId, bundleId),
		db
			.prepare('SELECT bundle_id, line, stage, at FROM discoveries WHERE user_id = ? AND bundle_id = ? ORDER BY at, stage')
			.bind(userId, bundleId),
		db
			.prepare('SELECT bundle_id, line, rating, at FROM line_reviews WHERE user_id = ? AND bundle_id = ? ORDER BY at, line')
			.bind(userId, bundleId)
	]);
	const reviewRows = (reviews as { results: { bundle_id: string; line: string; rating: LineReview['rating']; at: string }[] }).results;
	const discoveryRows = (discoveries as { results: { bundle_id: string; line: string; stage: Discovery['stage']; at: string }[] }).results;
	const cardRows = (cards as { results: { epd: string; state: string }[] }).results;
	const attemptRows = (attempts as { results: AttemptRow[] }).results;
	return {
		cards: Object.fromEntries(cardRows.map((r) => [r.epd, JSON.parse(r.state) as CardJson])),
		attempts: attemptRows.map((r) => ({
			bundleId: r.bundle_id,
			epd: r.epd,
			mode: r.mode,
			played: r.played,
			expected: r.expected,
			grade: r.grade,
			costCp: r.cost_cp,
			attemptNo: r.attempt_no,
			responseMs: r.response_ms,
			at: r.at
		})),
		discoveries: discoveryRows.map((r) => ({ bundleId: r.bundle_id, line: r.line, stage: r.stage, at: r.at })),
		reviews: reviewRows.map((r) => ({ bundleId: r.bundle_id, line: r.line, rating: r.rating, at: r.at }))
	};
}
