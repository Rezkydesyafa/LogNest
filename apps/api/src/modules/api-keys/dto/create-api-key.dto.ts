import { ApiProperty } from '@nestjs/swagger';
import { ApiKeyType } from '@prisma/client';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Docker Agent Key' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: ApiKeyType, example: ApiKeyType.SERVER })
  @IsEnum(ApiKeyType)
  type!: ApiKeyType;
}
