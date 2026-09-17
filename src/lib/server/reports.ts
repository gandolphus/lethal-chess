import { KINDS, MAX_BODY, MAX_CONTACT, MIN_BODY, type ReportKind } from '$lib/report';
import type { Database } from './db';
import { ApiError } from './http';

/** Everything C0 except tab and the two newline characters, plus DEL. */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const MAX_CONTEXT = 300;
const MAX_AGENT = 400;

export type NewReport = {
	kind: ReportKind;
	body: string;
	contact?: string | null;
	path?: string | null;
	viewport?: string | null;
	userAgent?: string | null;
	appVersion?: string | null;
};

export type Report = {
	id: number;
	kind: ReportKind;
	body: string;
	contact: string | null;
	path: string | null;
	viewport: string | null;
	userAgent: string | null;
	/** The user agent, read back as "Chrome 149 · Android". Computed here: the admin page is a component. */
	browser: string;
	appVersion: string | null;
	status: 'new' | 'seen' | 'closed';
	createdAt: number;
	/** Who sent it, when they were signed in and the account still exists. */
	name: string | null;
	email: string | null;
};

/** Control characters mangle a terminal and a table alike; everything else a reporter types is theirs. */
const clean = (value: string, max: number) =>
	value
		.replace(CONTROL, '')
		.trim()
		.slice(0, max);

const optional = (value: unknown, max: number): string | null => {
	if (typeof value !== 'string') return null;
	const text = clean(value, max);
	return text || null;
};

/**
 * Validates what the form sent. The reporter's own words are kept as they wrote them — only control
 * characters go, and only the length is capped.
 */
export function parseReport(input: Record<string, unknown>): NewReport {
	const kind = KINDS.includes(input.kind as ReportKind) ? (input.kind as ReportKind) : 'bug';
	const body = typeof input.body === 'string' ? clean(input.body, MAX_BODY) : '';
	if (body.length < MIN_BODY) throw new ApiError(400, 'Please describe what happened.');
	return {
		kind,
		body,
		contact: optional(input.contact, MAX_CONTACT),
		path: optional(input.path, MAX_CONTEXT),
		viewport: optional(input.viewport, MAX_CONTEXT),
		userAgent: optional(input.userAgent, MAX_AGENT),
		appVersion: optional(input.appVersion, MAX_CONTEXT)
	};
}

export async function saveReport(db: Database, userId: string | null, report: NewReport, now: Date): Promise<void> {
	await db
		.prepare(
			`INSERT INTO reports (user_id, kind, body, contact, path, viewport, user_agent, app_version, created_at)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
		)
		.bind(
			userId,
			report.kind,
			report.body,
			report.contact ?? null,
			report.path ?? null,
			report.viewport ?? null,
			report.userAgent ?? null,
			report.appVersion ?? null,
			now.getTime()
		)
		.run();
}

type Row = Omit<Report, 'userAgent' | 'browser' | 'appVersion' | 'createdAt'> & {
	user_agent: string | null;
	app_version: string | null;
	created_at: number;
};

/** Newest first, for the admin page. */
export async function recentReports(db: Database, limit = 100): Promise<Report[]> {
	const { results } = await db
		.prepare(
			`SELECT r.id, r.kind, r.body, r.contact, r.path, r.viewport, r.user_agent, r.app_version,
			        r.status, r.created_at, u.name, u.email
			 FROM reports r LEFT JOIN users u ON u.id = r.user_id
			 ORDER BY r.created_at DESC LIMIT ?1`
		)
		.bind(limit)
		.all<Row>();
	return results.map(({ user_agent, app_version, created_at, ...rest }) => ({
		...rest,
		userAgent: user_agent,
		browser: browserOf(user_agent),
		appVersion: app_version,
		createdAt: created_at
	}));
}

/**
 * A browser's name from its user-agent string. Not for anything that matters — it decides what a table
 * cell says, and "Chrome 149 · Android" is what makes a report reproducible where the raw string is
 * three lines of noise.
 */
export function browserOf(agent: string | null): string {
	if (!agent) return 'unknown';
	const platform = /iPhone|iPad/.test(agent) ? 'iOS' : /Android/.test(agent) ? 'Android' : /Mac OS X/.test(agent) ? 'macOS' : /Windows/.test(agent) ? 'Windows' : /Linux/.test(agent) ? 'Linux' : '';
	// Order matters: every one of these also claims to be Safari, and most claim to be Chrome.
	const engine =
		/(Firefox|FxiOS)\/([\d.]+)/.exec(agent)?.slice(1) ??
		/(EdgiOS|Edg)\/([\d.]+)/.exec(agent)?.slice(1) ??
		/(CriOS|Chrome)\/([\d.]+)/.exec(agent)?.slice(1) ??
		/Version\/([\d.]+).*(Safari)/.exec(agent)?.slice(1).reverse() ??
		null;
	const names: Record<string, string> = { FxiOS: 'Firefox', CriOS: 'Chrome', EdgiOS: 'Edge', Edg: 'Edge' };
	const browser = engine ? `${names[engine[0]] ?? engine[0]} ${engine[1].split('.')[0]}` : 'unknown browser';
	return platform ? `${browser} · ${platform}` : browser;
}
