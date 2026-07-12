import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RawLog, RawLogSchema } from '../../../../../packages/shared/src';
import { AuthModule } from '../auth/auth.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([{ name: RawLog.name, schema: RawLogSchema }]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
