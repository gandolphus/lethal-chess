import { describe, expect, it } from 'vitest';
import type { Attempt } from '$lib/drill/session.svelte';
import { importProgress, recordAttempts } from './progress';
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
	it('reports what the row quota bounds, per table and for the heaviest account', async () => {
		const db = createTestDb();
		const ann = await upsertGoogleUser(db, { sub: 'ann', email: 'ann@example.com', name: 'Ann', picture: null }, daysAgo(2));
		const bob = await upsertGoogleUser(db, { sub: 'bob', email: 'bob@example.com', name: 'Bob', picture: null }, daysAgo(1));
		await recordAttempts(db, ann.id, [attempt('ruy-lopez', 'a1'), attempt('ruy-lopez', 'a2'), attempt('ruy-lopez', 'a3')], now);
		await recordAttempts(db, bob.id, [attempt('sicilian', 'b1')], now);

		const stats = await siteStats(db, now);
		expect(stats.storage.rows).toBe(4);
		expect(stats.storage.byTable.find((t) => t.table === 'attempts')?.rows).toBe(4);
		expect(stats.storage.byTable.map((t) => t.table)).toEqual(['attempts', 'cards', 'discoveries', 'line_reviews']);
		// The heaviest account, not the total: the quota is per account.
		expect(stats.storage.largestAccount).toBe(3);
		expect(stats.storage.quota).toBeGreaterThan(0);
	});

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

describe('siteStats accounts', () => {
	const discovery = (bundleId: string, line: string, stage: 'entered' | 'discovered' = 'discovered') => ({
		bundleId,
		line,
		stage,
		at: '2026-09-15T11:00:00.000Z'
	});
	const review = (bundleId: string, line: string, at: string) => ({
		bundleId,
		line,
		rating: 'good' as const,
		at,
		stability: 1,
		difficulty: 1,
		due: '2026-09-20T00:00:00.000Z'
	});

	async function seeded() {
		const db = createTestDb();
		const ann = await upsertGoogleUser(db, { sub: 'ann', email: 'ann@example.com', name: 'Ann', picture: null }, daysAgo(20));
		const bob = await upsertGoogleUser(db, { sub: 'bob', email: 'bob@example.com', name: 'Bob', picture: null }, daysAgo(2));
		const cat = await upsertGoogleUser(db, { sub: 'cat', email: 'cat@example.com', name: 'Cat', picture: null }, daysAgo(1));

		// Ann explores and practises across two openings; her last act is three days ago.
		await importProgress(
			db,
			ann.id,
			{
				attempts: [attempt('ruy-lopez', 'a1'), attempt('ruy-lopez', 'a2')],
				cards: [],
				discoveries: [discovery('ruy-lopez', 'l1'), discovery('ruy-lopez', 'l2'), discovery('sicilian', 'l3', 'entered')],
				reviews: [review('ruy-lopez', 'l1', 'r1')]
			},
			daysAgo(3)
		);
		// Bob only ever explored, today, in one opening.
		await importProgress(db, bob.id, { attempts: [], cards: [], discoveries: [discovery('italian-game', 'l9')], reviews: [] }, now);
		// Cat signed in and did nothing at all — the case the question is really about.
		return { db, ann, bob, cat };
	}

	it('gives one row per account, most recently active first', async () => {
		const { db, ann, bob, cat } = await seeded();
		const { accounts } = await siteStats(db, now);
		expect(accounts.map((a) => a.name)).toEqual(['Bob', 'Ann', 'Cat']);
		expect(accounts.map((a) => a.id)).toEqual([bob.id, ann.id, cat.id]);
	});

	it('counts what each person did, and separates lines found from lines merely entered', async () => {
		const { db } = await seeded();
		const { accounts } = await siteStats(db, now);
		const ann = accounts.find((a) => a.name === 'Ann')!;
		expect(ann).toMatchObject({
			email: 'ann@example.com',
			discovered: 2,
			entered: 1,
			attempts: 2,
			reviews: 1,
			openings: 2, // ruy-lopez from both attempts and discoveries, sicilian from discoveries alone
			rows: 6 // 2 attempts + 3 discoveries + 1 review
		});
		expect(ann.lastActive).toBe(daysAgo(3).getTime());
	});

	it('shows an account that signed in and never came back, rather than hiding it', async () => {
		const { db } = await seeded();
		const cat = (await siteStats(db, now)).accounts.find((a) => a.name === 'Cat')!;
		expect(cat.lastActive).toBeNull();
		expect(cat).toMatchObject({ discovered: 0, entered: 0, attempts: 0, reviews: 0, openings: 0, rows: 0 });
		expect(cat.joined).toBe(daysAgo(1).getTime());
	});

	it('carries no drill content — only counts, timestamps and who the account is', async () => {
		const { db } = await seeded();
		const { accounts } = await siteStats(db, now);
		// The whole point of the shape: nothing here can say which position or move anyone played.
		for (const account of accounts) {
			expect(Object.keys(account).sort()).toEqual(
				['attempts', 'discovered', 'email', 'entered', 'id', 'joined', 'lastActive', 'name', 'openings', 'reviews', 'rows'].sort()
			);
		}
		expect(JSON.stringify(accounts)).not.toContain('rnbqkbnr');
	});
});
