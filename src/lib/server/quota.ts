import type { Database } from './db';
import { ApiError } from './http';

/**
 * How many rows one account may keep, across attempts, cards, discoveries and reviews together.
 *
 * Without a ceiling, a signed-in account can write until the database is full: the natural keys let the
 * caller make every row unique, so nothing is ever a duplicate. A measured import costs about 400 bytes
 * a row with its indexes, so this is roughly 80 MB — far more than any real learner reaches (the whole
 * catalogue is 3,810 lines, and an account that answered three hundred positions a day for two years
 * would still be under it) and far short of one account being able to fill the database.
 *
 * It bounds the *total*, which a rate limit cannot: a rate limit only decides how long filling it takes.
 */
export const ROW_QUOTA = 200_000;

const COUNT_ROWS = `
	SELECT
		(SELECT COUNT(*) FROM attempts WHERE user_id = ?1) +
		(SELECT COUNT(*) FROM cards WHERE user_id = ?1) +
		(SELECT COUNT(*) FROM discoveries WHERE user_id = ?1) +
		(SELECT COUNT(*) FROM line_reviews WHERE user_id = ?1) AS kept`;

/** Rows this account already keeps. Every table is counted through a user-leading index. */
export async function rowsKept(db: Database, userId: string): Promise<number> {
	const row = await db.prepare(COUNT_ROWS).bind(userId).first<{ kept: number }>();
	return row?.kept ?? 0;
}

/**
 * Refuses a write that would take the account past its ceiling. 507 rather than a 4xx on purpose: the
 * client keeps the rows and retries instead of dropping them, because a learner at the ceiling has data
 * worth keeping and a mistake here must not throw a real person's progress away.
 */
export async function assertWithinQuota(db: Database, userId: string, adding: number): Promise<void> {
	if (adding <= 0) return;
	const kept = await rowsKept(db, userId);
	if (kept + adding > ROW_QUOTA) {
		throw new ApiError(507, `This account is at its limit of ${ROW_QUOTA.toLocaleString('en')} saved rows.`);
	}
}
