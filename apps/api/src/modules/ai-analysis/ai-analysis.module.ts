import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { ParsedLog, ParsedLogSchema } from '../logs/schemas/parsed-log.schema';
import { RawLog, RawLogSchema } from '../logs/schemas/raw-log.schema';
import { AiAnalysisController } from './ai-analysis.controller';
import { AiAnalysisService } from './ai-analysis.service';
import { AiAnalysisValidator } from './ai-analysis.validator';
import { AI_PROVIDER } from './ai-provider.interface';
import { OpenAiProvider } from './openai.provider';
import { PromptBuilderService } from './prompt-builder.service';
import { AiAnalysisResult, AiAnalysisResultSchema } from './schemas/ai-analysis-result.schema';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: RawLog.name, schema: RawLogSchema },
      { name: ParsedLog.name, schema: ParsedLogSchema },
      { name: AiAnalysisResult.name, schema: AiAnalysisResultSchema },
    ]),
  ],
  controllers: [AiAnalysisController],
  providers: [
    AiAnalysisService,
    AiAnalysisValidator,
    OpenAiProvider,
    PromptBuilderService,
    { provide: AI_PROVIDER, useExisting: OpenAiProvider },
  ],
})
export class AiAnalysisModule {}
