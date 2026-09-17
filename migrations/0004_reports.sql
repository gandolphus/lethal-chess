-- What testers write on /report. Anyone may send one, signed in or not, so `user_id` is nullable —
-- and ON DELETE SET NULL rather than CASCADE, so closing an account keeps the report and forgets who
-- sent it. `context` is collected by the page (path, viewport, browser), not typed by the reporter.
CREATE TABLE reports (
	id INTEGER PRIMARY KEY,
	user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
	kind TEXT NOT NULL CHECK (kind IN ('bug', 'idea', 'other')),
	body TEXT NOT NULL,
	-- How to reach someone who was not signed in. Optional, and theirs to leave blank.
	contact TEXT,
	-- Where they were when it happened, and what they were using.
	path TEXT,
	viewport TEXT,
	user_agent TEXT,
	-- Which build, so a report can be tied to what was live when it was written.
	app_version TEXT,
	status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'seen', 'closed')),
	created_at INTEGER NOT NULL
) STRICT;

-- The admin page reads the newest first, and nothing else reads this table.
CREATE INDEX reports_recent ON reports (created_at DESC);
