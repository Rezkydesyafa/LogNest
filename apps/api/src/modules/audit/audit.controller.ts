import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuditService } from '../../common/services/audit.service';
import { ProjectAccessService } from '../../common/services/project-access.service';
import { ApiDocs, ApiIdParam } from '../../common/swagger/docs';
import { CurrentUserPayload } from '../../common/types/auth.types';
import { pagination } from '../../common/utils/pagination';
import { FindAuditLogsQueryDto } from './dto/find-audit-logs-query.dto';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/audit-logs')
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly access: ProjectAccessService,
  ) {}

  @Get()
  @ApiDocs('List who changed what in this project. Requires the admin role.')
  @ApiIdParam('projectId', 'Project id.')
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
    @Query() query: FindAuditLogsQueryDto,
  ) {
    // The trail names people and their IPs, so it is not readable by every member.
    await this.access.assert(user.id, projectId, ProjectRole.ADMIN);

    const { page, limit, skip } = pagination(query.page, query.limit);
    const [items, total] = await Promise.all([
      this.audit.findForProject(projectId, { skip, take: limit }),
      this.audit.countForProject(projectId),
    ]);

    return { items, page, limit, total };
  }
}
