-- Users, sessions and the progress log. Timestamps named *_at are unix epoch milliseconds,
-- except attempts.at, which keeps the client's ISO-8601 UTC string (sorts chronologically).
-- D1 enforces foreign keys, so deleting a user removes everything they own.

CREATE TABLE users (
	id TEXT PRIMARY KEY,
	google_sub TEXT NOT NULL UNIQUE,
	email TEXT NOT NULL,
	name TEXT NOT NULL,
	picture TEXT,
	created_at INTEGER NOT NULL
) STRICT;

-- id is the hex SHA-256 of the session token; the token itself is only ever in the cookie.
CREATE TABLE sessions (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	expires_at INTEGER NOT NULL
) STRICT, WITHOUT ROWID;

CREATE INDEX sessions_user ON sessions (user_id);

-- Append-only. One row per learner move in a drill.
CREATE TABLE attempts (
	id INTEGER PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	bundle_id TEXT NOT NULL,
	epd TEXT NOT NULL,
	mode TEXT NOT NULL CHECK (mode IN ('learn', 'practice')),
	played TEXT NOT NULL,
	expected TEXT NOT NULL,
	grade TEXT NOT NULL CHECK (grade IN ('pass', 'soft', 'fail')),
	cost_cp INTEGER,
	attempt_no INTEGER NOT NULL CHECK (attempt_no >= 1),
	response_ms INTEGER NOT NULL CHECK (response_ms >= 0),
	at TEXT NOT NULL,
	created_at INTEGER NOT NULL
) STRICT;

-- The natural key of an attempt: the same position, try number and millisecond cannot happen
-- twice. It makes re-sent batches and repeated imports no-ops (INSERT ... ON CONFLICT DO NOTHING),
-- and its (user_id, bundle_id, at) prefix serves the per-opening history read in order.
CREATE UNIQUE INDEX attempts_natural_key ON attempts (user_id, bundle_id, at, epd, attempt_no);

-- Derived FSRS state per card. Recomputable from attempts.
CREATE TABLE cards (
	user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	bundle_id TEXT NOT NULL,
	epd TEXT NOT NULL,
	state TEXT NOT NULL CHECK (json_valid(state)),
	updated_at INTEGER NOT NULL,
	PRIMARY KEY (user_id, bundle_id, epd)
) STRICT, WITHOUT ROWID;
