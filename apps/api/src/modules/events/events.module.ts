import { Module } from '@nestjs/common';
import { ProjectEventsService } from '../../../../../packages/shared/src';
import { AuthModule } from '../auth/auth.module';
import { EventsController } from './events.controller';

@Module({
  imports: [AuthModule],
  controllers: [EventsController],
  providers: [ProjectEventsService],
})
export class EventsModule {}
