import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { CurrentApiKey } from '../../common/decorators/current-api-key.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ClientApiKeyGuard } from '../../common/guards/client-api-key.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ServerApiKeyGuard } from '../../common/guards/server-api-key.guard';
import { ApiKeyContext, CurrentUserPayload } from '../../common/types/auth.types';
import { FindLogsQueryDto } from './dto/find-logs-query.dto';
import { FrontendLogDto } from './dto/frontend-log.dto';
import { LogIngestionDto } from './dto/log-ingestion.dto';
import { LogsService } from './logs.service';

@ApiTags('logs')
@Controller()
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Post('logs/ingest')
  @ApiSecurity('api-key')
  @UseGuards(ServerApiKeyGuard)
  ingest(@CurrentApiKey() apiKey: ApiKeyContext, @Body() dto: LogIngestionDto) {
    return this.logsService.ingest(apiKey, dto);
  }

  @Post('logs/frontend')
  @ApiSecurity('api-key')
  @UseGuards(ClientApiKeyGuard)
  ingestFrontend(@CurrentApiKey() apiKey: ApiKeyContext, @Body() dto: FrontendLogDto) {
    return this.logsService.ingestFrontend(apiKey, dto);
  }

  @Get('logs')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  findAll(@CurrentUser() user: CurrentUserPayload, @Query() query: FindLogsQueryDto) {
    return this.logsService.findAll(user.id, query);
  }

  @Get('logs/search')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  search(@CurrentUser() user: CurrentUserPayload, @Query() query: FindLogsQueryDto) {
    return this.logsService.findAll(user.id, query);
  }

  @Get('logs/:logId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('logId') logId: string) {
    return this.logsService.findOne(user.id, logId);
  }

  @Get('services/:serviceId/logs')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  findByService(
    @CurrentUser() user: CurrentUserPayload,
    @Param('serviceId') serviceId: string,
    @Query() query: FindLogsQueryDto,
  ) {
    return this.logsService.findByService(user.id, serviceId, query);
  }
}
