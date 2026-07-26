import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRole } from '@prisma/client';
import { IncidentAnalyzerService, PrismaService } from '../../../../../packages/shared/src';
import { AuditActor, AuditService } from '../../common/services/audit.service';
import { memberProjectFilter, ProjectAccessService } from '../../common/services/project-access.service';

/**
 * On-demand analysis triggered from the dashboard. The analysis itself lives in the shared
 * {@link IncidentAnalyzerService} so the worker can run the same code automatically.
 */
@Injectable()
export class AiAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly analyzer: IncidentAnalyzerService,
    private readonly audit: AuditService,
  ) {}

  async analyze(actor: AuditActor, incidentId: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, project: memberProjectFilter(actor.id!) },
      include: { service: true },
    });

    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    // Running an analysis costs money and rewrites incident fields, so it is a write.
    await this.access.assert(actor.id!, incident.projectId, ProjectRole.MEMBER);
    await this.audit.record({
      actor,
      action: 'incident.analysis_requested',
      targetType: 'incident',
      targetId: incident.id,
      projectId: incident.projectId,
    });

    return this.analyzer.analyze(incident);
  }
}
