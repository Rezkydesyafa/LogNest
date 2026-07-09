import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserPayload } from '../../common/types/auth.types';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@ApiTags('api-keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post('projects/:projectId/api-keys')
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param('projectId') projectId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.create(user.id, projectId, dto);
  }

  @Get('projects/:projectId/api-keys')
  findAll(@CurrentUser() user: CurrentUserPayload, @Param('projectId') projectId: string) {
    return this.apiKeysService.findAll(user.id, projectId);
  }

  @Delete('api-keys/:apiKeyId')
  revoke(@CurrentUser() user: CurrentUserPayload, @Param('apiKeyId') apiKeyId: string) {
    return this.apiKeysService.revoke(user.id, apiKeyId);
  }
}
