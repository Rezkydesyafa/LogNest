import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ApiKeyType } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../../../packages/shared/src';
import { HashingService } from '../../common/services/hashing.service';
import { ApiKeyContext } from '../../common/types/auth.types';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashingService: HashingService,
  ) {}

  async create(ownerId: string, projectId: string, dto: CreateApiKeyDto) {
    await this.ensureProjectOwner(ownerId, projectId);

    const rawKey = this.generateRawKey(dto.type);
    const apiKey = await this.prisma.apiKey.create({
      data: {
        name: dto.name,
        type: dto.type,
        prefix: rawKey.slice(0, 18),
        keyHash: this.hashingService.hashApiKey(rawKey),
        projectId,
      },
      select: this.safeSelect(),
    });

    return {
      ...apiKey,
      key: rawKey,
    };
  }

  async findAll(ownerId: string, projectId: string) {
    await this.ensureProjectOwner(ownerId, projectId);

    return this.prisma.apiKey.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: this.safeSelect(),
    });
  }

  async revoke(ownerId: string, apiKeyId: string) {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        id: apiKeyId,
        project: { ownerId },
      },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { revokedAt: new Date() },
    });

    return { revoked: true };
  }

  async validateRawKey(rawKey: string): Promise<ApiKeyContext> {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        keyHash: this.hashingService.hashApiKey(rawKey),
        revokedAt: null,
      },
      select: {
        id: true,
        type: true,
        projectId: true,
      },
    });

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return apiKey;
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

  private generateRawKey(type: ApiKeyType) {
    const label = type === ApiKeyType.SERVER ? 'server' : 'client';
    return `lm_${label}_${randomBytes(32).toString('base64url')}`;
  }

  private safeSelect() {
    return {
      id: true,
      name: true,
      type: true,
      prefix: true,
      projectId: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    };
  }
}
