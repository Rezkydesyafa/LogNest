import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ParsedLog, ParsedLogSchema, RawLog, RawLogSchema } from '../log-storage';
import { AiAnalysisResult, AiAnalysisResultSchema } from './ai-analysis-result.schema';
import { AI_PROVIDER } from './ai-provider.interface';
import { IncidentAnalyzerService } from './incident-analyzer.service';
import { OpenAiProvider } from './openai.provider';

/** Shared by the API (on-demand analysis) and the worker (automatic analysis). */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RawLog.name, schema: RawLogSchema },
      { name: ParsedLog.name, schema: ParsedLogSchema },
      { name: AiAnalysisResult.name, schema: AiAnalysisResultSchema },
    ]),
  ],
  providers: [IncidentAnalyzerService, OpenAiProvider, { provide: AI_PROVIDER, useExisting: OpenAiProvider }],
  exports: [IncidentAnalyzerService, MongooseModule],
})
export class AiAnalysisCoreModule {}
