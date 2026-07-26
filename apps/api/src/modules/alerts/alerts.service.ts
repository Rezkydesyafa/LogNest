import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AlertChannel, AlertChannelType, ProjectRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import {
  buildAlertRequest,
  openMaybeSealed,
  PrismaService,
  redactChannelConfig,
  resolveEncryptionKey,
  sealIfPossible,
} from '../../../../../packages/shared/src';
import { AuditActor, AuditService } from '../../common/services/audit.service';
import { memberProjectFilter, ProjectAccessService } from '../../common/services/project-access.service';
import {
  CreateAlertChannelDto,
  CreateAlertRuleDto,
  UpdateAlertChannelDto,
  UpdateAlertRuleDto,
} from './dto/alert.dto';

const TEST_TIMEOUT_MS = 5_000;

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async createChannel(actor: AuditActor, projectId: string, dto: CreateAlertChannelDto) {
    await this.access.assert(actor.id!, projectId, ProjectRole.ADMIN);
    this.assertUsableConfig(dto.type, dto.config);

    const channel = await this.prisma.alertChannel.create({
      data: {
        projectId,
        name: dto.name,
        type: dto.type,
        config: sealIfPossible(dto.config, this.encryptionKey) as object,
        enabled: dto.enabled ?? true,
      },
    });

    await this.audit.record({
      actor,
      action: 'alert_channel.created',
      targetType: 'alert_channel',
      targetId: channel.id,
      projectId,
      // Never the config: it holds the webhook secret.
      metadata: { name: channel.name, type: channel.type },
    });

    return this.toPublicChannel(channel);
  }

  async findChannels(userId: string, projectId: string) {
    await this.access.assert(userId, projectId);

    const channels = await this.prisma.alertChannel.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return channels.map((channel) => this.toPublicChannel(channel));
  }

  async updateChannel(actor: AuditActor, channelId: string, dto: UpdateAlertChannelDto) {
    const existing = await this.ownedChannel(actor.id!, channelId, ProjectRole.ADMIN);
    const type = dto.type ?? existing.type;
    const config = dto.config ?? this.channelConfig(existing);

    if (dto.type || dto.config) this.assertUsableConfig(type, config);

    const channel = await this.prisma.alertChannel.update({
      where: { id: channelId },
      data: {
        ...(dto.name === undefined ? {} : { name: dto.name }),
        ...(dto.type === undefined ? {} : { type: dto.type }),
        ...(dto.config === undefined
          ? {}
          : { config: sealIfPossible(dto.config, this.encryptionKey) as object }),
        ...(dto.enabled === undefined ? {} : { enabled: dto.enabled }),
      },
    });

    await this.audit.record({
      actor,
      action: 'alert_channel.updated',
      targetType: 'alert_channel',
      targetId: channelId,
      projectId: existing.projectId,
      metadata: { name: channel.name, enabled: channel.enabled, secretsChanged: Boolean(dto.config) },
    });

    return this.toPublicChannel(channel);
  }

  async deleteChannel(actor: AuditActor, channelId: string) {
    const channel = await this.ownedChannel(actor.id!, channelId, ProjectRole.ADMIN);
    await this.prisma.alertChannel.delete({ where: { id: channelId } });
    await this.audit.record({
      actor,
      action: 'alert_channel.deleted',
      targetType: 'alert_channel',
      targetId: channelId,
      projectId: channel.projectId,
      metadata: { name: channel.name, type: channel.type },
    });

    return { deleted: true };
  }

  /** Sends a synthetic alert so an operator can confirm the channel works before an outage. */
  async testChannel(actor: AuditActor, channelId: string) {
    const channel = await this.ownedChannel(actor.id!, channelId, ProjectRole.ADMIN);
    await this.audit.record({
      actor,
      action: 'alert_channel.tested',
      targetType: 'alert_channel',
      targetId: channelId,
      projectId: channel.projectId,
    });
    const request = buildAlertRequest(channel.type, this.channelConfig(channel), {
      trigger: 'CREATED',
      incidentId: 'test',
      title: 'LogMind test alert',
      severity: 'HIGH',
      serviceName: 'logmind',
      environment: 'test',
      occurrenceCount: 1,
      recentCount: 1,
      lastSeenAt: new Date(),
    });

    try {
      const response = await this.fetchImpl(request.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...request.headers },
        body: JSON.stringify(request.body),
        signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        return { delivered: false, error: `Channel responded ${response.status}` };
      }

      return { delivered: true };
    } catch (error) {
      return { delivered: false, error: error instanceof Error ? error.message : 'Delivery failed' };
    }
  }

  async createRule(actor: AuditActor, projectId: string, dto: CreateAlertRuleDto) {
    await this.access.assert(actor.id!, projectId, ProjectRole.ADMIN);
    const channel = await this.prisma.alertChannel.findFirst({
      where: { id: dto.channelId, projectId },
      select: { id: true },
    });

    if (!channel) {
      throw new BadRequestException('Alert channel not found in this project');
    }

    const rule = await this.prisma.alertRule.create({
      data: {
        projectId,
        channelId: dto.channelId,
        name: dto.name,
        minSeverity: dto.minSeverity ?? 'HIGH',
        serviceIds: dto.serviceIds ?? [],
        environments: dto.environments ?? [],
        onCreated: dto.onCreated ?? true,
        onSeverityIncrease: dto.onSeverityIncrease ?? true,
        onReopened: dto.onReopened ?? true,
        throttleMinutes: dto.throttleMinutes ?? 30,
        enabled: dto.enabled ?? true,
      },
    });

    await this.audit.record({
      actor,
      action: 'alert_rule.created',
      targetType: 'alert_rule',
      targetId: rule.id,
      projectId,
      metadata: { name: rule.name, minSeverity: rule.minSeverity, channelId: rule.channelId },
    });

    return rule;
  }

  async findRules(userId: string, projectId: string) {
    await this.access.assert(userId, projectId);

    return this.prisma.alertRule.findMany({
      where: { projectId },
      include: { channel: { select: { id: true, name: true, type: true, enabled: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRule(actor: AuditActor, ruleId: string, dto: UpdateAlertRuleDto) {
    const rule = await this.ownedRule(actor.id!, ruleId, ProjectRole.ADMIN);

    if (dto.channelId) {
      const channel = await this.prisma.alertChannel.findFirst({
        where: { id: dto.channelId, projectId: rule.projectId },
        select: { id: true },
      });

      if (!channel) {
        throw new BadRequestException('Alert channel not found in this project');
      }
    }

    const updated = await this.prisma.alertRule.update({ where: { id: ruleId }, data: { ...dto } });

    await this.audit.record({
      actor,
      action: 'alert_rule.updated',
      targetType: 'alert_rule',
      targetId: ruleId,
      projectId: rule.projectId,
      metadata: { ...dto },
    });

    return updated;
  }

  async deleteRule(actor: AuditActor, ruleId: string) {
    const rule = await this.ownedRule(actor.id!, ruleId, ProjectRole.ADMIN);
    await this.prisma.alertRule.delete({ where: { id: ruleId } });
    await this.audit.record({
      actor,
      action: 'alert_rule.deleted',
      targetType: 'alert_rule',
      targetId: ruleId,
      projectId: rule.projectId,
      metadata: { name: rule.name },
    });

    return { deleted: true };
  }

  async findDeliveries(userId: string, projectId: string) {
    await this.access.assert(userId, projectId);

    return this.prisma.alertDelivery.findMany({
      where: { rule: { projectId } },
      include: { rule: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** Fails fast on a config the dispatcher could not use, instead of at the first real incident. */
  private assertUsableConfig(type: AlertChannelType, config: Record<string, unknown>) {
    try {
      buildAlertRequest(type, config, {
        trigger: 'CREATED',
        incidentId: 'validation',
        title: 'validation',
        severity: 'HIGH',
        serviceName: 'validation',
        environment: 'validation',
        occurrenceCount: 0,
        recentCount: 0,
        lastSeenAt: new Date(0),
      });
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Invalid channel config');
    }
  }

  private toPublicChannel(channel: AlertChannel) {
    // Decrypt first so the caller still sees which non-secret fields are set.
    return { ...channel, config: redactChannelConfig(this.channelConfig(channel)) };
  }

  /** Reads a channel config that may be encrypted or, on older rows, plaintext. */
  private channelConfig(channel: Pick<AlertChannel, 'config'>): Record<string, unknown> {
    return openMaybeSealed<Record<string, unknown>>(channel.config, this.encryptionKey);
  }

  private get encryptionKey() {
    return resolveEncryptionKey(this.config.get<string>('ALERT_ENCRYPTION_KEY'));
  }

  private async ownedChannel(userId: string, channelId: string, minimum: ProjectRole = ProjectRole.VIEWER) {
    const channel = await this.prisma.alertChannel.findFirst({
      where: { id: channelId, project: memberProjectFilter(userId) },
    });

    if (!channel) {
      throw new NotFoundException('Alert channel not found');
    }

    await this.access.assert(userId, channel.projectId, minimum);
    return channel;
  }

  private async ownedRule(userId: string, ruleId: string, minimum: ProjectRole = ProjectRole.VIEWER) {
    const rule = await this.prisma.alertRule.findFirst({
      where: { id: ruleId, project: memberProjectFilter(userId) },
    });

    if (!rule) {
      throw new NotFoundException('Alert rule not found');
    }

    await this.access.assert(userId, rule.projectId, minimum);
    return rule;
  }
}
