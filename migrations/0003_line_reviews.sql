-- Reviews of discovered lines: the learner replayed a line from memory. Append-only; each line's
-- spaced-repetition state is derived by replaying its reviews. `line` is the EPD of the line's end.
CREATE TABLE line_reviews (
	user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	bundle_id TEXT NOT NULL,
	line TEXT NOT NULL,
	rating TEXT NOT NULL CHECK (rating IN ('again', 'hard', 'good')),
	at TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	PRIMARY KEY (user_id, bundle_id, line, at)
) STRICT, WITHOUT ROWID;
