import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { LOG_LEVELS } from '../../../../../../packages/shared/src';

export class FrontendLogDto {
  @ApiProperty({ example: 'frontend-dashboard' })
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

  @ApiProperty({ example: 'Unhandled promise rejection' })
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
  frontend?: Record<string, unknown>;

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
