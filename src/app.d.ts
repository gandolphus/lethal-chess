// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Database } from '$lib/server/db';
import type { Session } from '$lib/server/session';
import type { User } from '$lib/server/users';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: User | null;
			session: Session | null;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				/** D1 (wrangler.jsonc `d1_databases`). */
				DB: Database;
				/** Secrets: `wrangler secret put`, locally .dev.vars. Absent until configured. */
				GOOGLE_CLIENT_ID?: string;
				GOOGLE_CLIENT_SECRET?: string;
			};
		}
	}
}

export {};
