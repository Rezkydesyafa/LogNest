import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, LogLevel, LogSourceType } from '../../../../../packages/shared/src';

type RegisterLogInput = {
  name: string;
  environment: string;
  sourceType: LogSourceType;
  level: LogLevel;
  metadata?: unknown;
};

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByProject(ownerId: string, projectId: string) {
    await this.ensureProjectOwner(ownerId, projectId);

    return this.prisma.service.findMany({
      where: { projectId },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async findOne(ownerId: string, serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: {
        id: serviceId,
        project: { ownerId },
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return service;
  }

  async recordLog(projectId: string, input: RegisterLogInput) {
    const existing = await this.prisma.service.findUnique({
      where: {
        projectId_name_environment: {
          projectId,
          name: input.name,
          environment: input.environment,
        },
      },
    });

    const errorCount = input.level === 'error' || input.level === 'fatal' ? 1 : 0;

    if (!existing) {
      return this.prisma.service.create({
        data: {
          projectId,
          name: input.name,
          environment: input.environment,
          sourceTypes: [input.sourceType],
          metadata: input.metadata === undefined ? undefined : (input.metadata as object),
          logCount: 1,
          errorCount,
          lastSeenAt: new Date(),
        },
      });
    }

    return this.prisma.service.update({
      where: { id: existing.id },
      data: {
        sourceTypes: Array.from(new Set([...existing.sourceTypes, input.sourceType])),
        metadata: input.metadata === undefined ? existing.metadata ?? undefined : (input.metadata as object),
        lastSeenAt: new Date(),
        logCount: { increment: 1 },
        errorCount: { increment: errorCount },
      },
    });
  }

  private async ensureProjectOwner(ownerId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }
}
