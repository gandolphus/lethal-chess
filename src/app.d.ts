// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Database } from '$lib/server/db';
import type { Session } from '$lib/server/session';
import type { User } from '$lib/server/users';
import type { Layer } from '$lib/ui/layer';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: User | null;
			session: Session | null;
		}
		// interface PageData {}
		/** Shallow-routing state: a layer drawn over the page, if one is open ($lib/ui/layer). */
		interface PageState {
			layer?: Layer;
		}
		interface Platform {
			env: {
				/** D1 (wrangler.jsonc `d1_databases`). */
				DB: Database;
				/** Static assets (wrangler.jsonc `assets`). Absent under `vite dev`. */
				ASSETS?: { fetch(input: Request | URL | string): Promise<Response> };
				/**
				 * Per-user cap on write API calls (wrangler.jsonc `ratelimits`). Absent under `vite dev` and
				 * in tests, where there is nothing to protect.
				 */
				API_LIMIT?: { limit(options: { key: string }): Promise<{ success: boolean }> };
				/** Secrets: `wrangler secret put`, locally .dev.vars. Absent until configured. */
				GOOGLE_CLIENT_ID?: string;
				GOOGLE_CLIENT_SECRET?: string;
			};
		}
	}
}

export {};
