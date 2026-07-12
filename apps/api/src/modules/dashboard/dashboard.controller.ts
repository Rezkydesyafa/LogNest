import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiDocs } from '../../common/swagger/docs';
import { CurrentUserPayload } from '../../common/types/auth.types';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiDocs('Return dashboard summary counters and recent incident data.')
  summary(@CurrentUser() user: CurrentUserPayload, @Query() query: DashboardQueryDto) {
    return this.dashboardService.summary(user.id, query.projectId);
  }

  @Get('services-health')
  @ApiDocs('Return service health summaries for a project.')
  servicesHealth(@CurrentUser() user: CurrentUserPayload, @Query() query: DashboardQueryDto) {
    return this.dashboardService.servicesHealth(user.id, query.projectId);
  }

  @Get('api-performance')
  @ApiDocs('Return API endpoint performance summaries.')
  apiPerformance(@CurrentUser() user: CurrentUserPayload, @Query() query: DashboardQueryDto) {
    return this.dashboardService.apiPerformance(user.id, query.projectId);
  }

  @Get('frontend-errors')
  @ApiDocs('Return frontend error summaries.')
  frontendErrors(@CurrentUser() user: CurrentUserPayload, @Query() query: DashboardQueryDto) {
    return this.dashboardService.frontendErrors(user.id, query.projectId);
  }
}
