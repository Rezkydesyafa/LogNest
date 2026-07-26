import { Module } from '@nestjs/common';
import { AiAnalysisCoreModule } from '../../../../../packages/shared/src';
import { AuthModule } from '../auth/auth.module';
import { AiAnalysisController } from './ai-analysis.controller';
import { AiAnalysisService } from './ai-analysis.service';

@Module({
  imports: [AuthModule, AiAnalysisCoreModule],
  controllers: [AiAnalysisController],
  providers: [AiAnalysisService],
})
export class AiAnalysisModule {}
