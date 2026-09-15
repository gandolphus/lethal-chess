import type { Database } from './db';

export type User = { id: string; email: string; name: string; picture: string | null };

/** Identity claims taken from a verified Google ID token. `sub` is the stable account id. */
export type GoogleClaims = { sub: string; email: string; name: string; picture: string | null };

/** Creates the user on first sign-in; afterwards refreshes the profile fields Google may change. */
export async function upsertGoogleUser(db: Database, claims: GoogleClaims, now: Date): Promise<User> {
	const user = await db
		.prepare(
			`INSERT INTO users (id, google_sub, email, name, picture, created_at)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT (google_sub) DO UPDATE SET
			   email = excluded.email, name = excluded.name, picture = excluded.picture
			 RETURNING id, email, name, picture`
		)
		.bind(crypto.randomUUID(), claims.sub, claims.email, claims.name, claims.picture, now.getTime())
		.first<User>();
	if (!user) throw new Error('User upsert returned no row');
	return { id: user.id, email: user.email, name: user.name, picture: user.picture };
}
