import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../../packages/shared/src';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateProjectDto) {
    try {
      return await this.prisma.project.create({
        data: {
          ownerId,
          name: dto.name,
          description: dto.description,
        },
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Project name already exists');
      }
      throw error;
    }
  }

  findAll(ownerId: string) {
    return this.prisma.project.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(ownerId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async update(ownerId: string, projectId: string, dto: UpdateProjectDto) {
    await this.findOne(ownerId, projectId);

    try {
      return await this.prisma.project.update({
        where: { id: projectId },
        data: dto,
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Project name already exists');
      }
      throw error;
    }
  }

  async remove(ownerId: string, projectId: string) {
    await this.findOne(ownerId, projectId);
    await this.prisma.project.delete({ where: { id: projectId } });

    return { deleted: true };
  }

  private isUniqueError(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
