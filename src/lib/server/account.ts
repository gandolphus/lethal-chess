import type { Database } from './db';

/**
 * Everything stored about one user, as they would want to download it (GDPR access and
 * portability). Session token hashes are excluded: they are credentials, not personal data
 * the user needs, and they are useless outside this server anyway.
 */
export async function exportAccount(db: Database, userId: string, now: Date) {
	const user = await db
		.prepare('SELECT id, google_sub, email, name, picture, created_at FROM users WHERE id = ?')
		.bind(userId)
		.first<{ id: string; google_sub: string; email: string; name: string; picture: string | null; created_at: number }>();
	if (!user) return null;

	const attempts = await db
		.prepare(
			`SELECT bundle_id, epd, mode, played, expected, grade, cost_cp, attempt_no, response_ms, at
			 FROM attempts WHERE user_id = ? ORDER BY at, id`
		)
		.bind(userId)
		.all();
	const cards = await db
		.prepare('SELECT bundle_id, epd, state, updated_at FROM cards WHERE user_id = ? ORDER BY bundle_id, epd')
		.bind(userId)
		.all<{ bundle_id: string; epd: string; state: string; updated_at: number }>();

	const discoveries = await db
		.prepare('SELECT bundle_id, line, stage, at FROM discoveries WHERE user_id = ? ORDER BY at')
		.bind(userId)
		.all();

	const reviews = await db
		.prepare('SELECT bundle_id, line, rating, at FROM line_reviews WHERE user_id = ? ORDER BY at')
		.bind(userId)
		.all();

	return {
		exportedAt: now.toISOString(),
		account: {
			id: user.id,
			googleAccountId: user.google_sub,
			email: user.email,
			name: user.name,
			picture: user.picture,
			createdAt: new Date(user.created_at).toISOString()
		},
		attempts: attempts.results,
		cards: cards.results.map((c) => ({
			bundle_id: c.bundle_id,
			epd: c.epd,
			state: JSON.parse(c.state),
			updated_at: new Date(c.updated_at).toISOString()
		})),
		discoveries: discoveries.results,
		lineReviews: reviews.results
	};
}

/**
 * Permanently deletes a user and everything linked to them, in one transaction. Each table is
 * cleared explicitly rather than relying on ON DELETE CASCADE, so deletion does not depend on
 * foreign-key enforcement being switched on.
 */
export async function deleteAccount(db: Database, userId: string): Promise<void> {
	await db.batch([
		db.prepare('DELETE FROM attempts WHERE user_id = ?').bind(userId),
		db.prepare('DELETE FROM cards WHERE user_id = ?').bind(userId),
		db.prepare('DELETE FROM discoveries WHERE user_id = ?').bind(userId),
		db.prepare('DELETE FROM line_reviews WHERE user_id = ?').bind(userId),
		db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId),
		db.prepare('DELETE FROM users WHERE id = ?').bind(userId)
	]);
}
