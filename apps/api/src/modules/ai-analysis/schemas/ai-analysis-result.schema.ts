import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AiAnalysisResultDocument = HydratedDocument<AiAnalysisResult>;

@Schema({
  collection: 'ai_analysis_results',
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
})
export class AiAnalysisResult {
  @Prop({ required: true, index: true })
  incidentId!: string;

  @Prop({ required: true, index: true })
  projectId!: string;

  @Prop({ required: true })
  provider!: string;

  @Prop({ required: true })
  model!: string;

  @Prop({ required: true, enum: ['success', 'failed'], index: true })
  status!: 'success' | 'failed';

  @Prop({ type: Object, required: true })
  inputSnapshot!: Record<string, unknown>;

  @Prop()
  prompt?: string;

  @Prop({ type: Object })
  output?: Record<string, unknown>;

  @Prop()
  error?: string;
}

export const AiAnalysisResultSchema = SchemaFactory.createForClass(AiAnalysisResult);
