import type { Database } from './db';
import type { User } from './users';

/**
 * Accounts allowed to see /admin. Google has verified these addresses at sign-in
 * (`email_verified` is required in the OAuth callback), so the email is trustworthy.
 */
const ADMIN_EMAILS = new Set(['gandolphius@gmail.com']);

export const isAdmin = (user: User | null) => Boolean(user && ADMIN_EMAILS.has(user.email.toLowerCase()));

const DAY = 24 * 60 * 60 * 1000;

export type SiteStats = {
	users: { total: number; newLast7Days: number };
	activeLearners: { today: number; last7Days: number; last30Days: number };
	attemptsPerDay: { day: string; attempts: number; learners: number }[];
	topOpenings: { bundleId: string; learners: number; attempts: number }[];
	practice: { firstTries: number; passRate: number | null };
};

/** Aggregate numbers only — no individual user's data leaves this function. */
export async function siteStats(db: Database, now: Date): Promise<SiteStats> {
	const t = now.getTime();
	const count = async (query: string, ...values: number[]) =>
		(await db.prepare(query).bind(...values).first<{ n: number }>())?.n ?? 0;

	const activeSince = (since: number) =>
		count('SELECT COUNT(DISTINCT user_id) AS n FROM attempts WHERE created_at >= ?', since);

	const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

	const perDay = await db
		.prepare(
			`SELECT date(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS attempts, COUNT(DISTINCT user_id) AS learners
			 FROM attempts WHERE created_at >= ? GROUP BY day ORDER BY day`
		)
		.bind(t - 14 * DAY)
		.all<{ day: string; attempts: number; learners: number }>();

	const top = await db
		.prepare(
			`SELECT bundle_id AS bundleId, COUNT(DISTINCT user_id) AS learners, COUNT(*) AS attempts
			 FROM attempts WHERE created_at >= ? GROUP BY bundle_id ORDER BY learners DESC, attempts DESC LIMIT 10`
		)
		.bind(t - 30 * DAY)
		.all<{ bundleId: string; learners: number; attempts: number }>();

	const firstTries = await db
		.prepare(
			`SELECT COUNT(*) AS n, SUM(CASE WHEN grade = 'pass' THEN 1 ELSE 0 END) AS passes
			 FROM attempts WHERE mode = 'practice' AND attempt_no = 1`
		)
		.first<{ n: number; passes: number | null }>();

	return {
		users: {
			total: await count('SELECT COUNT(*) AS n FROM users'),
			newLast7Days: await count('SELECT COUNT(*) AS n FROM users WHERE created_at >= ?', t - 7 * DAY)
		},
		activeLearners: {
			today: await activeSince(startOfToday),
			last7Days: await activeSince(t - 7 * DAY),
			last30Days: await activeSince(t - 30 * DAY)
		},
		attemptsPerDay: perDay.results,
		topOpenings: top.results,
		practice: {
			firstTries: firstTries?.n ?? 0,
			passRate: firstTries?.n ? (firstTries.passes ?? 0) / firstTries.n : null
		}
	};
}
