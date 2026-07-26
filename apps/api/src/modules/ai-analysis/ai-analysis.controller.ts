import { Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiCreateDocs, ApiIdParam } from '../../common/swagger/docs';
import { AuditActor } from '../../common/services/audit.service';
import { AiAnalysisService } from './ai-analysis.service';

@ApiTags('ai-analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('incidents')
export class AiAnalysisController {
  constructor(private readonly aiAnalysisService: AiAnalysisService) {}

  @Post(':incidentId/analyze')
  @HttpCode(HttpStatus.OK)
  @ApiCreateDocs('Generate or refresh AI analysis for an incident.')
  @ApiIdParam('incidentId', 'Incident id.')
  analyze(@CurrentActor() actor: AuditActor, @Param('incidentId') incidentId: string) {
    return this.aiAnalysisService.analyze(actor, incidentId);
  }
}
