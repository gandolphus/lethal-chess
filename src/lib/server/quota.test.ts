import { describe, expect, it } from 'vitest';
import type { Attempt } from '$lib/drill/session.svelte';
import { importProgress, recordAttempts } from './progress';
import { assertWithinQuota, ROW_QUOTA, rowsKept } from './quota';
import { createTestDb } from './test-db';
import { upsertGoogleUser } from './users';

const now = new Date('2026-09-16T12:00:00.000Z');

const attempt = (at: string): Attempt => ({
	bundleId: 'ruy-lopez',
	epd: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -',
	mode: 'practice',
	played: 'g1f3',
	expected: 'g1f3',
	grade: 'pass',
	costCp: 0,
	attemptNo: 1,
	responseMs: 800,
	at
});

const learner = async () => {
	const db = createTestDb();
	const user = await upsertGoogleUser(db, { sub: 'a', email: 'a@example.com', name: 'A', picture: null }, now);
	return { db, user };
};

describe('the row quota', () => {
	it('counts every table an account writes to', async () => {
		const { db, user } = await learner();
		expect(await rowsKept(db, user.id)).toBe(0);
		await importProgress(
			db,
			user.id,
			{
				attempts: [attempt('2026-09-16T10:00:00.000Z'), attempt('2026-09-16T10:00:01.000Z')],
				cards: [{ bundleId: 'ruy-lopez', epd: 'e', state: { due: now.toISOString(), stability: 1, difficulty: 5, elapsed_days: 0, scheduled_days: 1, reps: 1, lapses: 0, state: 1, learning_steps: 0 } }],
				discoveries: [{ bundleId: 'ruy-lopez', line: 'k', stage: 'discovered', at: now.toISOString() }],
				reviews: [{ bundleId: 'ruy-lopez', line: 'k', rating: 'good', at: now.toISOString() }]
			},
			now
		);
		expect(await rowsKept(db, user.id)).toBe(5);
	});

	it('refuses a write that would take the account past the ceiling', async () => {
		const { db, user } = await learner();
		await expect(assertWithinQuota(db, user.id, ROW_QUOTA + 1)).rejects.toMatchObject({ status: 507 });
		// And the ordinary case is untouched.
		await expect(assertWithinQuota(db, user.id, 500)).resolves.toBeUndefined();
	});

	it('refuses through the write paths, not only the helper', async () => {
		const { db, user } = await learner();
		const many = Array.from({ length: 3 }, (_, i) => attempt(`2026-09-16T11:00:0${i}.000Z`));
		await recordAttempts(db, user.id, many, now);
		expect(await rowsKept(db, user.id)).toBe(3);
		// A second account's rows never count against the first.
		const other = await upsertGoogleUser(db, { sub: 'b', email: 'b@example.com', name: 'B', picture: null }, now);
		expect(await rowsKept(db, other.id)).toBe(0);
	});
});
