import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { LOG_LEVELS, SERVER_LOG_SOURCE_TYPES } from '../../../../../../packages/shared/src';

export class LogIngestionDto {
  @ApiProperty({ enum: SERVER_LOG_SOURCE_TYPES, example: 'docker' })
  @IsIn(SERVER_LOG_SOURCE_TYPES)
  sourceType!: string;

  @ApiProperty({ example: 'payment-service' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  serviceName!: string;

  @ApiProperty({ example: 'development' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  environment!: string;

  @ApiProperty({ enum: LOG_LEVELS, example: 'error' })
  @IsIn(LOG_LEVELS)
  level!: string;

  @ApiProperty({ example: 'Database connection timeout' })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  message!: string;

  @ApiPropertyOptional({ example: '2026-07-08T10:30:00.000Z' })
  @IsOptional()
  @IsISO8601()
  timestamp?: string;

  @ApiPropertyOptional({ example: 'req_123' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  requestId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  api?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  stackTrace?: string;
}
