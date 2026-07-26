import { Global, Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';

/**
 * Global so any service can record a metric without threading the registry through its
 * module graph. There must be exactly one registry per process.
 */
@Global()
@Module({
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
