// Test-only: a Database backed by Node's built-in SQLite, with the real D1 migrations applied.
// Never import this from app code (node:sqlite does not exist on Workers).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { Database, Statement, Value } from './db';

const MIGRATIONS = fileURLToPath(new URL('../../../migrations', import.meta.url));

class SqliteStatement implements Statement {
	constructor(
		readonly db: DatabaseSync,
		readonly query: string,
		readonly values: Value[] = []
	) {}

	bind(...values: Value[]) {
		return new SqliteStatement(this.db, this.query, values);
	}

	async first<T>() {
		return ((this.db.prepare(this.query).get(...(this.values as SQLInputValue[])) as T | undefined) ?? null);
	}

	async all<T>() {
		return { results: this.db.prepare(this.query).all(...(this.values as SQLInputValue[])) as T[] };
	}

	async run() {
		return { meta: { changes: Number(this.db.prepare(this.query).run(...(this.values as SQLInputValue[])).changes) } };
	}

	/** D1-shaped result for batch(): rows for readers, change count for writers. */
	exec() {
		const statement = this.db.prepare(this.query);
		const values = this.values as SQLInputValue[];
		if (statement.columns().length) return { results: statement.all(...values), meta: { changes: 0 } };
		return { results: [], meta: { changes: Number(statement.run(...values).changes) } };
	}
}

export type TestDatabase = Database & { sqlite: DatabaseSync };

export function createTestDb(): TestDatabase {
	const sqlite = new DatabaseSync(':memory:', { enableForeignKeyConstraints: true });
	for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
		sqlite.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
	}
	return {
		sqlite,
		prepare: (query) => new SqliteStatement(sqlite, query),
		async batch(statements) {
			sqlite.exec('BEGIN');
			try {
				const results = statements.map((s) => (s as SqliteStatement).exec());
				sqlite.exec('COMMIT');
				return results;
			} catch (e) {
				sqlite.exec('ROLLBACK');
				throw e;
			}
		}
	};
}
