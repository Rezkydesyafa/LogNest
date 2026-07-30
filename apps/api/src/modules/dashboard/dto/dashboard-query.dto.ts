import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { DASHBOARD_RANGES, DashboardRange } from '../dashboard-range';

export class DashboardQueryDto {
  @ApiProperty({ example: 'project_123' })
  @IsString()
  @MinLength(1)
  projectId!: string;

  @ApiProperty({ enum: DASHBOARD_RANGES, required: false, default: '24h' })
  @IsOptional()
  @IsIn(DASHBOARD_RANGES)
  range?: DashboardRange;
}
