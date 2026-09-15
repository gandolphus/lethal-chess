/**
 * The slice of Cloudflare D1's API this app uses. `platform.env.DB` (a D1Database) satisfies it,
 * and tests back it with node:sqlite running the same migrations (see test-db.ts).
 */
export type Value = string | number | null;

export interface Statement {
	bind(...values: Value[]): Statement;
	first<T = Record<string, unknown>>(): Promise<T | null>;
	all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
	run(): Promise<{ meta: { changes: number } }>;
}

export interface Database {
	prepare(query: string): Statement;
	/** Runs the statements in order inside one transaction. */
	batch(statements: Statement[]): Promise<unknown[]>;
}
