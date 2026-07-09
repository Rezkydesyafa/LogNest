import { Module } from '@nestjs/common';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { HashingService } from '../../common/services/hashing.service';
import { AuthModule } from '../auth/auth.module';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';

@Module({
  imports: [AuthModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeyGuard, HashingService],
  exports: [ApiKeysService, ApiKeyGuard],
})
export class ApiKeysModule {}
