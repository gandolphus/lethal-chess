/**
 * Shared by the form and the endpoint that receives it. Not under `$lib/server`: the page needs the
 * length to count down to, and importing the server module into a component ships the database with it.
 */
export const KINDS = ['bug', 'idea', 'other'] as const;
export type ReportKind = (typeof KINDS)[number];

/**
 * Long enough for "I pressed X, expected Y, got Z" with the steps in between; short enough that one
 * paste cannot fill the table. The form counts down to it so nobody loses what they wrote.
 */
export const MAX_BODY = 4000;
export const MIN_BODY = 4;
export const MAX_CONTACT = 200;

/**
 * The page a report is about becomes an `href` and a stored path, so it may only ever be a path within
 * this site. A bare `/` prefix is not enough: `//evil.example` is a protocol-relative URL, and
 * `/\evil.example` is treated as one by some browsers.
 */
export const ownPath = (value: string | null | undefined): string | null =>
	value && value.length <= 300 && value.startsWith('/') && !/^\/[/\\]/.test(value) ? value : null;

export type ReportDraft = { kind: ReportKind; body: string; contact: string };

const DRAFT_KEY = 'lethal:report:draft';

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * A half-written report survives the form closing. The report is a layer over the page, and every way
 * out of a layer — Escape, Back, a tap beside it — is too easy to make destructive; so closing keeps
 * the words, and opening finds them. Session storage: it lasts the tab and no longer, which is how long
 * "I was in the middle of saying something" lasts. Storage that is missing or throws keeps nothing.
 */
export function readDraft(storage: DraftStorage | undefined): ReportDraft | null {
	try {
		const raw = storage?.getItem(DRAFT_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<ReportDraft>;
		const body = typeof parsed.body === 'string' ? parsed.body.slice(0, MAX_BODY) : '';
		const contact = typeof parsed.contact === 'string' ? parsed.contact.slice(0, MAX_CONTACT) : '';
		if (!body && !contact) return null;
		return { kind: KINDS.includes(parsed.kind as ReportKind) ? (parsed.kind as ReportKind) : 'bug', body, contact };
	} catch {
		return null;
	}
}

/** Keeps the draft, or removes it once there is nothing in it: an empty draft is not a draft. */
export function writeDraft(storage: DraftStorage | undefined, draft: ReportDraft): void {
	try {
		if (!draft.body && !draft.contact) storage?.removeItem(DRAFT_KEY);
		else storage?.setItem(DRAFT_KEY, JSON.stringify(draft));
	} catch {
		// Private mode or blocked storage: the draft lasts as long as the form is open.
	}
}

export function clearDraft(storage: DraftStorage | undefined): void {
	try {
		storage?.removeItem(DRAFT_KEY);
	} catch {
		// Nothing was kept, so there is nothing to clear.
	}
}
