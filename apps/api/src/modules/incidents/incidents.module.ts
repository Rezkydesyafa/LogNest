import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ParsedLog, ParsedLogSchema, RawLog, RawLogSchema } from '../../../../../packages/shared/src';
import { AuthModule } from '../auth/auth.module';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: RawLog.name, schema: RawLogSchema },
      { name: ParsedLog.name, schema: ParsedLogSchema },
    ]),
  ],
  controllers: [IncidentsController],
  providers: [IncidentsService],
})
export class IncidentsModule {}
