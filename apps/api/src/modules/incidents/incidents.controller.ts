import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiDocs, ApiIdParam } from '../../common/swagger/docs';
import { CurrentUserPayload } from '../../common/types/auth.types';
import { FindIncidentsQueryDto } from './dto/find-incidents-query.dto';
import { UpdateIncidentStatusDto } from './dto/update-incident-status.dto';
import { IncidentsService } from './incidents.service';

@ApiTags('incidents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @ApiDocs('List incidents with filters and pagination.')
  findAll(@CurrentUser() user: CurrentUserPayload, @Query() query: FindIncidentsQueryDto) {
    return this.incidentsService.findAll(user.id, query);
  }

  @Get(':incidentId')
  @ApiDocs('Get one incident by id.')
  @ApiIdParam('incidentId', 'Incident id.')
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('incidentId') incidentId: string) {
    return this.incidentsService.findOne(user.id, incidentId);
  }

  @Patch(':incidentId/status')
  @ApiDocs('Update incident status.')
  @ApiIdParam('incidentId', 'Incident id.')
  updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('incidentId') incidentId: string,
    @Body() dto: UpdateIncidentStatusDto,
  ) {
    return this.incidentsService.updateStatus(user.id, incidentId, dto.status);
  }

  @Get(':incidentId/logs')
  @ApiDocs('List logs associated with an incident fingerprint.')
  @ApiIdParam('incidentId', 'Incident id.')
  logs(
    @CurrentUser() user: CurrentUserPayload,
    @Param('incidentId') incidentId: string,
    @Query() query: FindIncidentsQueryDto,
  ) {
    return this.incidentsService.logs(user.id, incidentId, query);
  }
}
