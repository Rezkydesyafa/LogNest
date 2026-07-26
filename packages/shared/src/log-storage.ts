import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { LOG_LEVELS, LOG_SOURCE_TYPES, LogLevel, LogSourceType } from './constants';

export const RAW_LOG_COLLECTION = 'raw_logs';
export const PARSED_LOG_COLLECTION = 'parsed_logs';

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

@Schema({
  collection: RAW_LOG_COLLECTION,
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
})
export class RawLog {
  @Prop({ type: String, required: true })
  projectId!: string;

  @Prop({ type: String, required: true })
  serviceId!: string;

  @Prop({ type: String, required: true })
  apiKeyId!: string;

  @Prop({ type: String, required: true, enum: LOG_SOURCE_TYPES })
  sourceType!: LogSourceType;

  @Prop({ type: String, required: true })
  serviceName!: string;

  @Prop({ type: String, required: true })
  environment!: string;

  @Prop({ type: String, required: true, enum: LOG_LEVELS })
  level!: LogLevel;

  @Prop({ type: String, required: true })
  message!: string;

  @Prop({ type: Date, required: true })
  timestamp!: Date;

  @Prop({ type: String })
  requestId?: string;

  @Prop({ type: Object })
  api?: Record<string, unknown>;

  @Prop({ type: Object })
  frontend?: Record<string, unknown>;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  @Prop({ type: String })
  stackTrace?: string;
}

export const RawLogSchema = SchemaFactory.createForClass(RawLog);

// Every read filters by project and sorts by timestamp, so the compound indexes below are
// what actually keeps the log list and the dashboard aggregations off a collection scan.
RawLogSchema.index({ projectId: 1, timestamp: -1 });
RawLogSchema.index({ projectId: 1, level: 1, timestamp: -1 });
RawLogSchema.index({ projectId: 1, serviceId: 1, timestamp: -1 });
RawLogSchema.index({ projectId: 1, sourceType: 1, timestamp: -1 });
RawLogSchema.index({ projectId: 1, requestId: 1 });
// Serves both the anchored `api.path` filter and the dashboard endpoint aggregation.
RawLogSchema.index({ projectId: 1, 'api.path': 1, timestamp: -1 });
// Keyword search uses $text, which needs this index to run at all.
RawLogSchema.index(
  { message: 'text', stackTrace: 'text' },
  { name: 'raw_logs_text', weights: { message: 10, stackTrace: 1 } },
);
RawLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: THIRTY_DAYS_SECONDS });

@Schema({
  collection: PARSED_LOG_COLLECTION,
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
})
export class ParsedLog {
  @Prop({ type: String, required: true })
  rawLogId!: string;

  @Prop({ type: String, required: true })
  projectId!: string;

  @Prop({ type: String, required: true })
  serviceId!: string;

  @Prop({ type: String, required: true, enum: LOG_SOURCE_TYPES })
  sourceType!: LogSourceType;

  @Prop({ type: String, required: true, enum: LOG_LEVELS })
  level!: LogLevel;

  @Prop({ type: String, required: true })
  normalizedMessage!: string;

  @Prop({ type: String })
  fingerprint?: string;

  @Prop({ type: String })
  stackTraceHash?: string;
}

export const ParsedLogSchema = SchemaFactory.createForClass(ParsedLog);
ParsedLogSchema.index({ rawLogId: 1 }, { unique: true });
// Incident sample lookups always filter on all three fields and sort by recency.
ParsedLogSchema.index({ projectId: 1, serviceId: 1, fingerprint: 1, createdAt: -1 });
ParsedLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: THIRTY_DAYS_SECONDS });
