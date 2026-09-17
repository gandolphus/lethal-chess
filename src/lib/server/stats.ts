import type { Database } from './db';
import { ROW_QUOTA } from './quota';
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
	/** How much of the database is in use, and how close the heaviest account is to its ceiling. */
	storage: { rows: number; byTable: { table: string; rows: number }[]; largestAccount: number; quota: number };
	/** One row per account: who signed up, and whether they are actually using it. */
	accounts: Account[];
};

export type Account = {
	id: string;
	name: string;
	email: string;
	joined: number;
	/** The last of anything they did, or null if they have only ever signed in. */
	lastActive: number | null;
	discovered: number;
	entered: number;
	attempts: number;
	reviews: number;
	openings: number;
	rows: number;
};

/**
 * Every account, most recently active first. Counts and timestamps only — how much someone has done and
 * when, never *what*: no position, move or line leaves this query. It is the administrator's answer to
 * "has anyone signed up, and is anyone coming back", which the aggregate numbers above cannot give.
 *
 * At this size one query with four grouped joins is cheaper than a round trip per account, and every
 * subquery groups by the user-leading primary key or index.
 */
const ACCOUNTS = `
	SELECT
		u.id, u.name, u.email, u.created_at AS joined,
		COALESCE(d.discovered, 0) AS discovered,
		COALESCE(d.entered, 0) AS entered,
		COALESCE(a.n, 0) AS attempts,
		COALESCE(r.n, 0) AS reviews,
		COALESCE(o.n, 0) AS openings,
		COALESCE(a.n, 0) + COALESCE(c.n, 0) + COALESCE(d.n, 0) + COALESCE(r.n, 0) AS rows,
		NULLIF(MAX(COALESCE(a.last, 0), COALESCE(d.last, 0), COALESCE(r.last, 0)), 0) AS lastActive
	FROM users u
	LEFT JOIN (SELECT user_id, COUNT(*) AS n, MAX(created_at) AS last FROM attempts GROUP BY user_id) a ON a.user_id = u.id
	LEFT JOIN (
		SELECT user_id, COUNT(*) AS n, MAX(created_at) AS last,
			SUM(stage = 'discovered') AS discovered, SUM(stage = 'entered') AS entered
		FROM discoveries GROUP BY user_id
	) d ON d.user_id = u.id
	LEFT JOIN (SELECT user_id, COUNT(*) AS n, MAX(created_at) AS last FROM line_reviews GROUP BY user_id) r ON r.user_id = u.id
	LEFT JOIN (SELECT user_id, COUNT(*) AS n FROM cards GROUP BY user_id) c ON c.user_id = u.id
	LEFT JOIN (
		SELECT user_id, COUNT(*) AS n FROM (
			SELECT user_id, bundle_id FROM attempts
			UNION SELECT user_id, bundle_id FROM discoveries
		) GROUP BY user_id
	) o ON o.user_id = u.id
	ORDER BY lastActive DESC NULLS LAST, joined DESC
	LIMIT 200`;

/** Aggregates, plus one row per account — counts and timestamps, never anyone's drill content. */
export async function siteStats(db: Database, now: Date): Promise<SiteStats> {
	const t = now.getTime();
	const count = async (query: string, ...values: number[]) =>
		(await db.prepare(query).bind(...values).first<{ n: number }>())?.n ?? 0;

	// Exploring records discoveries and reviewing records line reviews, not attempts: all three count as activity.
	const activeSince = (since: number) =>
		count(
			`SELECT COUNT(DISTINCT user_id) AS n FROM (
				SELECT user_id, created_at FROM attempts
				UNION ALL SELECT user_id, created_at FROM discoveries
				UNION ALL SELECT user_id, created_at FROM line_reviews
			) WHERE created_at >= ?`,
			since
		);

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

	// What the row quota is there to bound. Every count is over a user-leading index.
	const TABLES = ['attempts', 'cards', 'discoveries', 'line_reviews'];
	const byTable = await Promise.all(
		TABLES.map(async (table) => ({ table, rows: await count(`SELECT COUNT(*) AS n FROM ${table}`) }))
	);
	const largestAccount = await count(
		`SELECT COALESCE(MAX(kept), 0) AS n FROM (
			SELECT user_id, COUNT(*) AS kept FROM (
				SELECT user_id FROM attempts
				UNION ALL SELECT user_id FROM cards
				UNION ALL SELECT user_id FROM discoveries
				UNION ALL SELECT user_id FROM line_reviews
			) GROUP BY user_id
		)`
	);

	const accounts = await db.prepare(ACCOUNTS).all<Account>();

	return {
		accounts: accounts.results,
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
		storage: { rows: byTable.reduce((n, t) => n + t.rows, 0), byTable, largestAccount, quota: ROW_QUOTA },
		practice: {
			firstTries: firstTries?.n ?? 0,
			passRate: firstTries?.n ? (firstTries.passes ?? 0) / firstTries.n : null
		}
	};
}
