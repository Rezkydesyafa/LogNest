-- Alerting: notify a channel when an incident opens, escalates, or reopens.
CREATE TYPE "AlertChannelType" AS ENUM ('SLACK', 'DISCORD', 'TELEGRAM', 'WEBHOOK');
CREATE TYPE "AlertTrigger" AS ENUM ('CREATED', 'SEVERITY_INCREASED', 'REOPENED');
CREATE TYPE "AlertDeliveryStatus" AS ENUM ('SENT', 'FAILED', 'THROTTLED');

CREATE TABLE "AlertChannel" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AlertChannelType" NOT NULL,
    "config" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AlertChannel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "minSeverity" "IncidentSeverity" NOT NULL DEFAULT 'HIGH',
    "serviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "environments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "onCreated" BOOLEAN NOT NULL DEFAULT true,
    "onSeverityIncrease" BOOLEAN NOT NULL DEFAULT true,
    "onReopened" BOOLEAN NOT NULL DEFAULT true,
    "throttleMinutes" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AlertDelivery" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "trigger" "AlertTrigger" NOT NULL,
    "status" "AlertDeliveryStatus" NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlertDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AlertChannel_projectId_name_key" ON "AlertChannel"("projectId", "name");
CREATE INDEX "AlertChannel_projectId_idx" ON "AlertChannel"("projectId");
CREATE UNIQUE INDEX "AlertRule_projectId_name_key" ON "AlertRule"("projectId", "name");
CREATE INDEX "AlertRule_projectId_enabled_idx" ON "AlertRule"("projectId", "enabled");
CREATE INDEX "AlertDelivery_ruleId_createdAt_idx" ON "AlertDelivery"("ruleId", "createdAt");
CREATE INDEX "AlertDelivery_incidentId_idx" ON "AlertDelivery"("incidentId");

ALTER TABLE "AlertChannel" ADD CONSTRAINT "AlertChannel_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_channelId_fkey"
    FOREIGN KEY ("channelId") REFERENCES "AlertChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_ruleId_fkey"
    FOREIGN KEY ("ruleId") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertDelivery" ADD CONSTRAINT "AlertDelivery_channelId_fkey"
    FOREIGN KEY ("channelId") REFERENCES "AlertChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
