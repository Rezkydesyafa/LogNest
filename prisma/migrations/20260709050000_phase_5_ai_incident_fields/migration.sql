ALTER TABLE "Incident" ADD COLUMN "aiSummary" TEXT;
ALTER TABLE "Incident" ADD COLUMN "aiPossibleCause" TEXT;
ALTER TABLE "Incident" ADD COLUMN "aiImpact" TEXT;
ALTER TABLE "Incident" ADD COLUMN "aiSuggestedActions" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Incident" ADD COLUMN "aiConfidence" TEXT;
ALTER TABLE "Incident" ADD COLUMN "aiLastAnalyzedAt" TIMESTAMP(3);
ALTER TABLE "Incident" ADD COLUMN "aiError" TEXT;
