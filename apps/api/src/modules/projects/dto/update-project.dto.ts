import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsTimeZone } from '../../../common/validators/is-time-zone.validator';

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'Ecommerce Platform' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Docker Compose observability demo' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    example: 'Asia/Jakarta',
    description: 'IANA timezone deciding where "today" starts on the dashboard.',
  })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
