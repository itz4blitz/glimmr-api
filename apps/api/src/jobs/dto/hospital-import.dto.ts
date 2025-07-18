import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsNumber, Min, Max, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class TriggerHospitalImportDto {
  @ApiProperty({
    description: 'State code to import hospitals for (e.g., IN, CA)',
    example: 'IN',
    required: false,
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({
    description: 'Force refresh of existing hospital data',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;

  @ApiProperty({
    description: 'Batch size for processing hospitals',
    example: 50,
    required: false,
    minimum: 1,
    maximum: 100,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  batchSize?: number;
}

export class TriggerPriceFileDownloadDto {
  @ApiProperty({
    description: 'Force reprocess existing file',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  forceReprocess?: boolean;
}

export class StartHospitalImportDto {
  @ApiProperty({
    description: 'Data source (url, file, manual)',
    example: 'url',
    required: true,
  })
  @IsString()
  source: string;

  @ApiProperty({
    description: 'URL for data import',
    example: 'https://example.com/data.csv',
    required: false,
  })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiProperty({
    description: 'Job priority (1-10)',
    example: 5,
    required: false,
    minimum: 1,
    maximum: 10,
    default: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10)
  priority?: number;
}

export class StartPriceUpdateDto {
  @ApiProperty({
    description: 'Specific hospital ID (optional)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsString()
  hospitalId?: string;

  @ApiProperty({
    description: 'Job priority (1-10)',
    example: 5,
    required: false,
    minimum: 1,
    maximum: 10,
    default: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10)
  priority?: number;
}

export class TriggerPRAScanDto {
  @ApiProperty({
    description: 'Test mode (only scan a few states)',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  testMode?: boolean;

  @ApiProperty({
    description: 'Force refresh even if recently updated',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;
}

export class TriggerAnalyticsRefreshDto {
  @ApiProperty({
    description: 'Specific metric types to refresh (optional)',
    example: ['total_hospitals', 'avg_price_by_state'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  metricTypes?: string[];

  @ApiProperty({
    description: 'Force refresh even if metrics exist',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;

  @ApiProperty({
    description: 'Batch size for processing metrics',
    example: 100,
    required: false,
    minimum: 10,
    maximum: 1000,
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(10)
  @Max(1000)
  batchSize?: number;
}
