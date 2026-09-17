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
