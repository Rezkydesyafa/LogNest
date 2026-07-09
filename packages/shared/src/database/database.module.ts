import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { DEFAULT_MONGODB_URL } from '../constants';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URL') ?? DEFAULT_MONGODB_URL,
      }),
    }),
  ],
  providers: [PrismaService, RedisService],
  exports: [PrismaService, RedisService, MongooseModule],
})
export class DatabaseModule {}
