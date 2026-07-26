import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
const AI_ANALYSIS_RETENTION_SECONDS = 60 * 60 * 24 * 90;

@Schema({
  collection: 'ai_analysis_results',
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
})
export class AiAnalysisResult {
  @Prop({ type: String, required: true, index: true })
  incidentId!: string;

  @Prop({ type: String, required: true, index: true })
  projectId!: string;

  @Prop({ type: String, required: true })
  provider!: string;

  @Prop({ type: String, required: true })
  model!: string;

  @Prop({ type: String, required: true, enum: ['success', 'failed'], index: true })
  status!: 'success' | 'failed';

  @Prop({ type: Object, required: true })
  inputSnapshot!: Record<string, unknown>;

  @Prop({ type: String })
  prompt?: string;

  @Prop({ type: Object })
  output?: Record<string, unknown>;

  @Prop({ type: String })
  error?: string;
}

export const AiAnalysisResultSchema = SchemaFactory.createForClass(AiAnalysisResult);
AiAnalysisResultSchema.index({ createdAt: 1 }, { expireAfterSeconds: AI_ANALYSIS_RETENTION_SECONDS });
