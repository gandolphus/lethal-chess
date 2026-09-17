import { fail } from '@sveltejs/kit';
import { ApiError } from '$lib/server/http';
import { parseReport, saveReport } from '$lib/server/reports';
import type { Actions, PageServerLoad } from './$types';

/**
 * `?from=` becomes an `href` on this page, so it may only ever be a path within this site. A bare `/`
 * prefix is not enough: `//evil.example` is a protocol-relative URL, and `/\evil.example` is treated as
 * one by some browsers.
 */
const ownPath = (value: string | null): string | null =>
	value && value.length <= 300 && value.startsWith('/') && !/^\/[/\\]/.test(value) ? value : null;

export const load: PageServerLoad = ({ locals, url, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	return {
		signedIn: Boolean(locals.user),
		name: locals.user?.name ?? null,
		// `?from=/openings/italian-game/explore` — where the reporter pressed "Report a bug".
		from: ownPath(url.searchParams.get('from'))
	};
};

export const actions: Actions = {
	default: async (event) => {
		const { request, locals, platform, getClientAddress } = event;
		const db = platform?.env.DB;
		if (!db) return fail(503, { error: 'The server is unreachable right now — please try again in a minute.' });

		const form = await request.formData();
		const values = Object.fromEntries(form) as Record<string, unknown>;

		// Keyed by the account where there is one, by the address otherwise: a report needs no sign-in,
		// and without a key an open endpoint is an open invitation.
		const limiter = platform?.env.API_LIMIT;
		if (limiter) {
			const key = locals.user ? `report:${locals.user.id}` : `report:${getClientAddress()}`;
			if (!(await limiter.limit({ key })).success) {
				return fail(429, { ...values, error: 'That is a lot of reports at once — give it a minute.' });
			}
		}

		try {
			const report = parseReport({
				...values,
				// Taken from the request, not the form: a reporter should not have to know or type it,
				// and it is the one field that cannot be got wrong.
				userAgent: request.headers.get('user-agent')
			});
			await saveReport(db, locals.user?.id ?? null, report, new Date());
			return { sent: true };
		} catch (error) {
			if (error instanceof ApiError) return fail(error.status, { ...values, error: error.message });
			throw error;
		}
	}
};
