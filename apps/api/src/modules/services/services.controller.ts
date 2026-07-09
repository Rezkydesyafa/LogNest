import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserPayload } from '../../common/types/auth.types';
import { ServicesService } from './services.service';

@ApiTags('services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get('projects/:projectId/services')
  findByProject(@CurrentUser() user: CurrentUserPayload, @Param('projectId') projectId: string) {
    return this.servicesService.findByProject(user.id, projectId);
  }

  @Get('services/:serviceId')
  findOne(@CurrentUser() user: CurrentUserPayload, @Param('serviceId') serviceId: string) {
    return this.servicesService.findOne(user.id, serviceId);
  }
}
