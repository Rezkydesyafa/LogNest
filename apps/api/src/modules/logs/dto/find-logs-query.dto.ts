import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LOG_LEVELS, LOG_SOURCE_TYPES } from '../../../../../../packages/shared/src';

export class FindLogsQueryDto {
  @ApiPropertyOptional({ example: 'project_123' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ example: 'service_123' })
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional({ enum: LOG_SOURCE_TYPES, example: 'api' })
  @IsOptional()
  @IsIn(LOG_SOURCE_TYPES)
  sourceType?: string;

  @ApiPropertyOptional({ enum: LOG_LEVELS, example: 'error' })
  @IsOptional()
  @IsIn(LOG_LEVELS)
  level?: string;

  @ApiPropertyOptional({ example: 'development' })
  @IsOptional()
  @IsString()
  environment?: string;

  @ApiPropertyOptional({ example: 'timeout' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ example: '2026-07-08T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-07-09T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  statusCode?: number;

  @ApiPropertyOptional({ example: '/checkout' })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
