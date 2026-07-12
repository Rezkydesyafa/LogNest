import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ParsedLog, ParsedLogSchema, RawLog, RawLogSchema } from '../../../../../packages/shared/src';
import { AuthModule } from '../auth/auth.module';
import { AiAnalysisController } from './ai-analysis.controller';
import { AiAnalysisService } from './ai-analysis.service';
import { AI_PROVIDER } from './ai-provider.interface';
import { OpenAiProvider } from './openai.provider';
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
    OpenAiProvider,
    { provide: AI_PROVIDER, useExisting: OpenAiProvider },
  ],
})
export class AiAnalysisModule {}
