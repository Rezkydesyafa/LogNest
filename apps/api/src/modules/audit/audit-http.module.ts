import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditController } from './audit.controller';

@Module({
  imports: [AuthModule],
  controllers: [AuditController],
})
export class AuditHttpModule {}
