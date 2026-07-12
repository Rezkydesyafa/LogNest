import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiDocs, ApiIdParam } from '../../common/swagger/docs';
import { CurrentUserPayload } from '../../common/types/auth.types';
import { ServicesService } from './services.service';

@ApiTags('services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get('projects/:projectId/services')
  @ApiDocs('List services auto-registered for a project.')
  @ApiIdParam('projectId', 'Project id.')
  findByProject(@CurrentUser() user: CurrentUserPayload, @Param('projectId') projectId: string) {
    return this.servicesService.findByProject(user.id, projectId);
  }

  @Get('services/:serviceId')
  @ApiDocs('Get one service by id.')
  @ApiIdParam('serviceId', 'Service id.')
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('serviceId') serviceId: string) {
    return this.servicesService.findOne(user.id, serviceId);
  }
}
