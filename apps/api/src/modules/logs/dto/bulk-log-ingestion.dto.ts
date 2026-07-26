import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { LogIngestionDto } from './log-ingestion.dto';

/**
 * The cap mirrors `INGEST_BULK_MAX_ITEMS` and is enforced here as well so an oversized
 * batch is rejected by validation before any of it is redacted or written.
 */
export const BULK_INGEST_MAX_ITEMS = 500;

export class BulkLogIngestionDto {
  @ApiProperty({ type: [LogIngestionDto], maxItems: BULK_INGEST_MAX_ITEMS })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_INGEST_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => LogIngestionDto)
  logs!: LogIngestionDto[];
}
