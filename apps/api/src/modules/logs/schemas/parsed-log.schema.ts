import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { LOG_LEVELS, LOG_SOURCE_TYPES, LogLevel, LogSourceType } from '../../../../../../packages/shared/src';

export type ParsedLogDocument = HydratedDocument<ParsedLog>;
const PARSED_LOG_RETENTION_SECONDS = 60 * 60 * 24 * 30;

@Schema({
  collection: 'parsed_logs',
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
})
export class ParsedLog {
  @Prop({ required: true, index: true })
  rawLogId!: string;

  @Prop({ required: true, index: true })
  projectId!: string;

  @Prop({ required: true, index: true })
  serviceId!: string;

  @Prop({ required: true, enum: LOG_SOURCE_TYPES, index: true })
  sourceType!: LogSourceType;

  @Prop({ required: true, enum: LOG_LEVELS, index: true })
  level!: LogLevel;

  @Prop({ required: true })
  normalizedMessage!: string;

  @Prop({ index: true })
  fingerprint?: string;

  @Prop({ index: true })
  stackTraceHash?: string;
}

export const ParsedLogSchema = SchemaFactory.createForClass(ParsedLog);
ParsedLogSchema.index({ rawLogId: 1 }, { unique: true });
ParsedLogSchema.index({ projectId: 1, serviceId: 1, fingerprint: 1 });
ParsedLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: PARSED_LOG_RETENTION_SECONDS });
