import { describe, expect, it } from 'vitest';
import type { Attempt } from '$lib/drill/session.svelte';
import { recordAttempts } from './progress';
import { isAdmin, siteStats } from './stats';
import { createTestDb } from './test-db';
import { upsertGoogleUser } from './users';

const now = new Date('2026-09-15T12:00:00.000Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

const attempt = (bundleId: string, at: string, grade: Attempt['grade'] = 'pass', attemptNo = 1): Attempt => ({
	bundleId,
	epd: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -',
	mode: 'practice',
	played: 'g1f3',
	expected: 'g1f3',
	grade,
	costCp: 0,
	attemptNo,
	responseMs: 800,
	at
});

describe('isAdmin', () => {
	const user = (email: string) => ({ id: 'x', email, name: 'x', picture: null });
	it('admits only the configured account', () => {
		expect(isAdmin(user('gandolphius@gmail.com'))).toBe(true);
		expect(isAdmin(user('Gandolphius@Gmail.com'))).toBe(true);
		expect(isAdmin(user('someone@example.com'))).toBe(false);
		expect(isAdmin(null)).toBe(false);
	});
});

describe('siteStats', () => {
	it('aggregates learners, activity windows, openings and first-try precision', async () => {
		const db = createTestDb();
		const ann = await upsertGoogleUser(db, { sub: 'ann', email: 'ann@example.com', name: 'Ann', picture: null }, daysAgo(20));
		const bob = await upsertGoogleUser(db, { sub: 'bob', email: 'bob@example.com', name: 'Bob', picture: null }, daysAgo(2));

		await recordAttempts(db, ann.id, [attempt('ruy-lopez', 'a1'), attempt('ruy-lopez', 'a2', 'fail'), attempt('ruy-lopez', 'a3', 'pass', 2)], now);
		await recordAttempts(db, bob.id, [attempt('ruy-lopez', 'b1'), attempt('sicilian', 'b2')], daysAgo(3));
		await recordAttempts(db, bob.id, [attempt('sicilian', 'b3')], daysAgo(40));

		const stats = await siteStats(db, now);
		expect(stats.users).toEqual({ total: 2, newLast7Days: 1 });
		expect(stats.activeLearners).toEqual({ today: 1, last7Days: 2, last30Days: 2 });
		expect(stats.topOpenings[0]).toEqual({ bundleId: 'ruy-lopez', learners: 2, attempts: 4 });
		expect(stats.attemptsPerDay.map((d) => d.day)).toEqual(['2026-09-12', '2026-09-15']);
		// First tries: 5 (the attemptNo-2 retry is excluded), 4 passes.
		expect(stats.practice).toEqual({ firstTries: 5, passRate: 0.8 });
	});
});
