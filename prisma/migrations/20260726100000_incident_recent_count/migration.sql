-- Separate the lifetime occurrence total from the rolling 10 minute window count.
-- Before this migration "occurrenceCount" was overwritten with the window count on
-- every update, so a long-running incident appeared to lose occurrences once the
-- burst calmed down. Existing rows keep their last known value as the seed total.
ALTER TABLE "Incident" ADD COLUMN "recentCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "Incident" SET "recentCount" = "occurrenceCount";
