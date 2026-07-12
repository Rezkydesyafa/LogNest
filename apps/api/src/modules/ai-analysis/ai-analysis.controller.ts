import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiCreateDocs, ApiIdParam } from '../../common/swagger/docs';
import { CurrentUserPayload } from '../../common/types/auth.types';
import { AiAnalysisService } from './ai-analysis.service';

@ApiTags('ai-analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('incidents')
export class AiAnalysisController {
  constructor(private readonly aiAnalysisService: AiAnalysisService) {}

  @Post(':incidentId/analyze')
  @ApiCreateDocs('Generate or refresh AI analysis for an incident.')
  @ApiIdParam('incidentId', 'Incident id.')
  analyze(@CurrentUser() user: CurrentUserPayload, @Param('incidentId') incidentId: string) {
    return this.aiAnalysisService.analyze(user.id, incidentId);
  }
}
