import { Global, Module } from '@nestjs/common';
import { ProjectAccessService } from './project-access.service';

/**
 * Every feature module needs the same access check, so it is registered globally rather
 * than re-imported (and re-implemented) in each module.
 */
@Global()
@Module({
  providers: [ProjectAccessService],
  exports: [ProjectAccessService],
})
export class ProjectAccessModule {}
