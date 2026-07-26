-- Dashboard "today" used the API server's local timezone, so a UTC server showed a day
-- that started 7 hours late for a UTC+7 team. The window is now per project.
ALTER TABLE "Project" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';
