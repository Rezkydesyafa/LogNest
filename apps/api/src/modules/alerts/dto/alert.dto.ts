import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { AlertChannelType, IncidentSeverity } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const CHANNEL_TYPES = Object.values(AlertChannelType);
const SEVERITIES = Object.values(IncidentSeverity);

export class CreateAlertChannelDto {
  @ApiProperty({ example: 'ops-slack' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ enum: CHANNEL_TYPES, example: 'SLACK' })
  @IsIn(CHANNEL_TYPES)
  type!: AlertChannelType;

  @ApiProperty({
    description: 'SLACK/DISCORD: { webhookUrl }. TELEGRAM: { botToken, chatId }. WEBHOOK: { url, headers? }.',
    example: { webhookUrl: 'https://hooks.slack.com/services/...' },
  })
  @IsObject()
  config!: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateAlertChannelDto extends PartialType(CreateAlertChannelDto) {}

export class CreateAlertRuleDto {
  @ApiProperty({ example: 'critical-production' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'channel_123' })
  @IsString()
  channelId!: string;

  @ApiPropertyOptional({ enum: SEVERITIES, default: 'HIGH' })
  @IsOptional()
  @IsIn(SEVERITIES)
  minSeverity?: IncidentSeverity;

  @ApiPropertyOptional({ type: [String], description: 'Empty means every service.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  serviceIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Empty means every environment.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  environments?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  onCreated?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  onSeverityIncrease?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  onReopened?: boolean;

  @ApiPropertyOptional({ default: 30, minimum: 0, maximum: 1440 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  throttleMinutes?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateAlertRuleDto extends PartialType(CreateAlertRuleDto) {}
