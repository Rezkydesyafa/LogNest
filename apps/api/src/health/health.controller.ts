import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Check API, PostgreSQL, MongoDB, and Redis health.' })
  @ApiOkResponse({ description: 'Service and dependency health.' })
  check() {
    return this.healthService.check();
  }
}
