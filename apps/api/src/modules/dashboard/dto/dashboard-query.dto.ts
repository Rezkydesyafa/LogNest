import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class DashboardQueryDto {
  @ApiProperty({ example: 'project_123' })
  @IsString()
  @MinLength(1)
  projectId!: string;
}
