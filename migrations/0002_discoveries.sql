-- Lines found while exploring. One row per line and stage reached: 'entered' when the learner
-- reaches the line's entrance, 'discovered' when they reach its end. `line` is the EPD of the
-- line's end position; `at` is the client's ISO-8601 UTC string, as in attempts.
CREATE TABLE discoveries (
	user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	bundle_id TEXT NOT NULL,
	line TEXT NOT NULL,
	stage TEXT NOT NULL CHECK (stage IN ('entered', 'discovered')),
	at TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	PRIMARY KEY (user_id, bundle_id, line, stage)
) STRICT, WITHOUT ROWID;
