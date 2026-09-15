import type { Cookies } from '@sveltejs/kit';
import type { Database } from './db';
import { randomBase64url } from './encoding';
import type { User } from './users';

// Database sessions after the Lucia guide: a random token lives only in the cookie,
// the database keys the session by its SHA-256, so a leaked table cannot be replayed.

export const SESSION_COOKIE = 'session';
const DAY = 24 * 60 * 60 * 1000;
export const SESSION_TTL = 30 * DAY;
/** Sessions used with less than this much life left are extended to a full TTL. */
export const RENEW_WITHIN = 15 * DAY;

export type Session = { id: string; userId: string; expiresAt: Date };
export type SessionValidation = { session: Session; user: User; renewed: boolean };

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateSessionToken(): string {
	return randomBase64url(TOKEN_BYTES);
}

export async function hashToken(token: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(db: Database, token: string, userId: string, now: Date): Promise<Session> {
	const session = { id: await hashToken(token), userId, expiresAt: new Date(now.getTime() + SESSION_TTL) };
	await db.batch([
		db.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?').bind(userId, now.getTime()),
		db
			.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
			.bind(session.id, userId, session.expiresAt.getTime())
	]);
	return session;
}

type SessionRow = {
	id: string;
	user_id: string;
	expires_at: number;
	email: string;
	name: string;
	picture: string | null;
};

export async function validateSessionToken(db: Database, token: string, now: Date): Promise<SessionValidation | null> {
	if (!TOKEN_PATTERN.test(token)) return null;
	const id = await hashToken(token);
	const row = await db
		.prepare(
			`SELECT s.id, s.user_id, s.expires_at, u.email, u.name, u.picture
			 FROM sessions s JOIN users u ON u.id = s.user_id
			 WHERE s.id = ?`
		)
		.bind(id)
		.first<SessionRow>();
	if (!row) return null;

	if (now.getTime() >= row.expires_at) {
		await db.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
		return null;
	}

	const session: Session = { id, userId: row.user_id, expiresAt: new Date(row.expires_at) };
	const renewed = row.expires_at - now.getTime() < RENEW_WITHIN;
	if (renewed) {
		session.expiresAt = new Date(now.getTime() + SESSION_TTL);
		await db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').bind(session.expiresAt.getTime(), id).run();
	}

	return {
		session,
		user: { id: row.user_id, email: row.email, name: row.name, picture: row.picture },
		renewed
	};
}

export async function invalidateSession(db: Database, sessionId: string): Promise<void> {
	await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

// `secure` is left to SvelteKit's default: true everywhere except plain-http localhost.
export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date) {
	cookies.set(SESSION_COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', expires: expiresAt });
}

export function deleteSessionCookie(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/', httpOnly: true, sameSite: 'lax' });
}
