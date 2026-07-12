import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { LOG_LEVELS, LOG_SOURCE_TYPES, LogLevel, LogSourceType } from '../../../../../../packages/shared/src';

export type RawLogDocument = HydratedDocument<RawLog>;
const RAW_LOG_RETENTION_SECONDS = 60 * 60 * 24 * 30;

@Schema({
  collection: 'raw_logs',
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
})
export class RawLog {
  @Prop({ required: true, index: true })
  projectId!: string;

  @Prop({ required: true, index: true })
  serviceId!: string;

  @Prop({ required: true, index: true })
  apiKeyId!: string;

  @Prop({ required: true, enum: LOG_SOURCE_TYPES, index: true })
  sourceType!: LogSourceType;

  @Prop({ required: true, index: true })
  serviceName!: string;

  @Prop({ required: true, index: true })
  environment!: string;

  @Prop({ required: true, enum: LOG_LEVELS, index: true })
  level!: LogLevel;

  @Prop({ required: true })
  message!: string;

  @Prop({ required: true, index: true })
  timestamp!: Date;

  @Prop({ index: true })
  requestId?: string;

  @Prop({ type: Object })
  api?: Record<string, unknown>;

  @Prop({ type: Object })
  frontend?: Record<string, unknown>;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  @Prop()
  stackTrace?: string;
}

export const RawLogSchema = SchemaFactory.createForClass(RawLog);
RawLogSchema.index({ message: 'text', stackTrace: 'text' });
RawLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: RAW_LOG_RETENTION_SECONDS });
