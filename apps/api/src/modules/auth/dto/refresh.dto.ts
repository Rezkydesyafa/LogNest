import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshDto {
  @ApiPropertyOptional({
    description: 'Refresh token. Optional when it is sent in the logmind_refresh_token cookie.',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(512)
  refreshToken?: string;
}
