import { Global, Module } from '@nestjs/common';
import { PinoLogger } from '../../../../../packages/shared/src';
import { AuditService } from './audit.service';

/** Global for the same reason as project access: nearly every mutation records one. */
@Global()
@Module({
  providers: [AuditService, PinoLogger],
  exports: [AuditService],
})
export class AuditModule {}
