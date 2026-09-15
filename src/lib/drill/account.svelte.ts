import { BrowserProgressStore, type ProgressStore } from './progress';
import { ServerProgressStore } from './server-store';
import { SyncedProgressStore, type SyncStatus } from './synced-store';

/** Save state for signed-in learners; null while signed out (progress is browser-only then). */
export const sync = $state<{ status: SyncStatus | null }>({ status: null });

let current: { userId: string | null; store: ProgressStore } | null = null;

/**
 * One progress store per page lifetime: signed out → this browser only; signed in →
 * local-first with background sync to the account. Switching user replaces it.
 */
export function progressStore(userId: string | null): ProgressStore {
	if (current?.userId === userId) return current.store;
	if (!userId) {
		sync.status = null;
		current = { userId: null, store: new BrowserProgressStore() };
		return current.store;
	}
	const store = new SyncedProgressStore({
		userId,
		server: new ServerProgressStore(),
		onStatus: (status) => (sync.status = status)
	});
	sync.status = 'synced';
	current = { userId, store };
	return store;
}
