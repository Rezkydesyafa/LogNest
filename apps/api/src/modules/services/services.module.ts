import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ServiceStatsBuffer } from './service-stats.buffer';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
  imports: [AuthModule],
  controllers: [ServicesController],
  providers: [ServicesService, ServiceStatsBuffer],
  exports: [ServicesService, ServiceStatsBuffer],
})
export class ServicesModule {}
