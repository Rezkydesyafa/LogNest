import { Module } from '@nestjs/common';
import { ClientApiKeyGuard } from '../../common/guards/client-api-key.guard';
import { ServerApiKeyGuard } from '../../common/guards/server-api-key.guard';
import { HashingService } from '../../common/services/hashing.service';
import { AuthModule } from '../auth/auth.module';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';

@Module({
  imports: [AuthModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ClientApiKeyGuard, ServerApiKeyGuard, HashingService],
  exports: [ApiKeysService, ClientApiKeyGuard, ServerApiKeyGuard],
})
export class ApiKeysModule {}
