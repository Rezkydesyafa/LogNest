import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentActor } from '../../common/decorators/current-actor.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiCreateDocs, ApiDeleteDocs, ApiDocs, ApiIdParam } from '../../common/swagger/docs';
import { AuditActor } from '../../common/services/audit.service';
import { CurrentUserPayload } from '../../common/types/auth.types';
import { AlertsService } from './alerts.service';
import {
  CreateAlertChannelDto,
  CreateAlertRuleDto,
  UpdateAlertChannelDto,
  UpdateAlertRuleDto,
} from './dto/alert.dto';

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post('projects/:projectId/alert-channels')
  @ApiCreateDocs('Create a notification channel for a project.')
  @ApiIdParam('projectId', 'Project id.')
  createChannel(
    @CurrentActor() actor: AuditActor,
    @Param('projectId') projectId: string,
    @Body() dto: CreateAlertChannelDto,
  ) {
    return this.alertsService.createChannel(actor, projectId, dto);
  }

  @Get('projects/:projectId/alert-channels')
  @ApiDocs('List notification channels. Channel secrets are never returned.')
  @ApiIdParam('projectId', 'Project id.')
  findChannels(@CurrentUser() user: CurrentUserPayload, @Param('projectId') projectId: string) {
    return this.alertsService.findChannels(user.id, projectId);
  }

  @Patch('alert-channels/:channelId')
  @ApiDocs('Update a notification channel.')
  @ApiIdParam('channelId', 'Alert channel id.')
  updateChannel(
    @CurrentActor() actor: AuditActor,
    @Param('channelId') channelId: string,
    @Body() dto: UpdateAlertChannelDto,
  ) {
    return this.alertsService.updateChannel(actor, channelId, dto);
  }

  @Delete('alert-channels/:channelId')
  @ApiDeleteDocs('Delete a notification channel and its rules.')
  @ApiIdParam('channelId', 'Alert channel id.')
  deleteChannel(@CurrentActor() actor: AuditActor, @Param('channelId') channelId: string) {
    return this.alertsService.deleteChannel(actor, channelId);
  }

  @Post('alert-channels/:channelId/test')
  @HttpCode(HttpStatus.OK)
  @ApiCreateDocs('Send a test alert through a channel.')
  @ApiIdParam('channelId', 'Alert channel id.')
  testChannel(@CurrentActor() actor: AuditActor, @Param('channelId') channelId: string) {
    return this.alertsService.testChannel(actor, channelId);
  }

  @Post('projects/:projectId/alert-rules')
  @ApiCreateDocs('Create an alert rule.')
  @ApiIdParam('projectId', 'Project id.')
  createRule(
    @CurrentActor() actor: AuditActor,
    @Param('projectId') projectId: string,
    @Body() dto: CreateAlertRuleDto,
  ) {
    return this.alertsService.createRule(actor, projectId, dto);
  }

  @Get('projects/:projectId/alert-rules')
  @ApiDocs('List alert rules for a project.')
  @ApiIdParam('projectId', 'Project id.')
  findRules(@CurrentUser() user: CurrentUserPayload, @Param('projectId') projectId: string) {
    return this.alertsService.findRules(user.id, projectId);
  }

  @Patch('alert-rules/:ruleId')
  @ApiDocs('Update an alert rule.')
  @ApiIdParam('ruleId', 'Alert rule id.')
  updateRule(
    @CurrentActor() actor: AuditActor,
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateAlertRuleDto,
  ) {
    return this.alertsService.updateRule(actor, ruleId, dto);
  }

  @Delete('alert-rules/:ruleId')
  @ApiDeleteDocs('Delete an alert rule.')
  @ApiIdParam('ruleId', 'Alert rule id.')
  deleteRule(@CurrentActor() actor: AuditActor, @Param('ruleId') ruleId: string) {
    return this.alertsService.deleteRule(actor, ruleId);
  }

  @Get('projects/:projectId/alert-deliveries')
  @ApiDocs('List the 50 most recent alert deliveries for a project.')
  @ApiIdParam('projectId', 'Project id.')
  findDeliveries(@CurrentUser() user: CurrentUserPayload, @Param('projectId') projectId: string) {
    return this.alertsService.findDeliveries(user.id, projectId);
  }
}
