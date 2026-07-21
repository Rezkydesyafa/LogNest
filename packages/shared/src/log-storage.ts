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
  @Prop({ type: String, required: true, index: true })
  projectId!: string;

  @Prop({ type: String, required: true, index: true })
  serviceId!: string;

  @Prop({ type: String, required: true, index: true })
  apiKeyId!: string;

  @Prop({ type: String, required: true, enum: LOG_SOURCE_TYPES, index: true })
  sourceType!: LogSourceType;

  @Prop({ type: String, required: true, index: true })
  serviceName!: string;

  @Prop({ type: String, required: true, index: true })
  environment!: string;

  @Prop({ type: String, required: true, enum: LOG_LEVELS, index: true })
  level!: LogLevel;

  @Prop({ type: String, required: true })
  message!: string;

  @Prop({ type: Date, required: true, index: true })
  timestamp!: Date;

  @Prop({ type: String, index: true })
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
RawLogSchema.index({ message: 'text', stackTrace: 'text' });
RawLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: THIRTY_DAYS_SECONDS });

@Schema({
  collection: PARSED_LOG_COLLECTION,
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
})
export class ParsedLog {
  @Prop({ type: String, required: true })
  rawLogId!: string;

  @Prop({ type: String, required: true, index: true })
  projectId!: string;

  @Prop({ type: String, required: true, index: true })
  serviceId!: string;

  @Prop({ type: String, required: true, enum: LOG_SOURCE_TYPES, index: true })
  sourceType!: LogSourceType;

  @Prop({ type: String, required: true, enum: LOG_LEVELS, index: true })
  level!: LogLevel;

  @Prop({ type: String, required: true })
  normalizedMessage!: string;

  @Prop({ type: String, index: true })
  fingerprint?: string;

  @Prop({ type: String, index: true })
  stackTraceHash?: string;
}

export const ParsedLogSchema = SchemaFactory.createForClass(ParsedLog);
ParsedLogSchema.index({ rawLogId: 1 }, { unique: true });
ParsedLogSchema.index({ projectId: 1, serviceId: 1, fingerprint: 1 });
ParsedLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: THIRTY_DAYS_SECONDS });
