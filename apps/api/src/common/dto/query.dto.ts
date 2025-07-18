import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsBoolean, Min, Max, IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class PaginationQueryDto {
  @ApiProperty({
    description: 'Number of results to return',
    example: 10,
    required: false,
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({
    description: 'Number of results to skip (offset-based pagination)',
    example: 0,
    required: false,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number;

  @ApiProperty({
    description: 'Cursor for cursor-based pagination (more efficient for large datasets)',
    example: '2023-01-01T00:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiProperty({
    description: 'Pagination strategy: offset (default) or cursor',
    example: 'offset',
    required: false,
    enum: ['offset', 'cursor'],
    default: 'offset',
  })
  @IsOptional()
  @IsString()
  @IsIn(['offset', 'cursor'])
  paginationType?: 'offset' | 'cursor';
}

export class HospitalFilterQueryDto extends PaginationQueryDto {
  @ApiProperty({
    description: 'Filter by state',
    example: 'CA',
    required: false,
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({
    description: 'Filter by city',
    example: 'Los Angeles',
    required: false,
  })
  @IsOptional()
  @IsString()
  city?: string;
}

export class PriceFilterQueryDto extends PaginationQueryDto {
  @ApiProperty({
    description: 'Filter by hospital ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsString()
  hospital?: string;

  @ApiProperty({
    description: 'Filter by service type',
    example: 'MRI',
    required: false,
  })
  @IsOptional()
  @IsString()
  service?: string;

  @ApiProperty({
    description: 'Filter by state',
    example: 'CA',
    required: false,
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({
    description: 'Minimum price filter',
    example: 100,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiProperty({
    description: 'Maximum price filter',
    example: 1000,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;
}

export class JobFilterQueryDto extends PaginationQueryDto {
  @ApiProperty({
    description: 'Filter by job status',
    example: 'completed',
    required: false,
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({
    description: 'Filter by job type',
    example: 'hospital-import',
    required: false,
  })
  @IsOptional()
  @IsString()
  type?: string;
}

export class PriceComparisonQueryDto {
  @ApiProperty({
    description: 'Service to compare',
    example: 'MRI',
    required: true,
  })
  @IsString()
  service: string;

  @ApiProperty({
    description: 'Filter by state',
    example: 'CA',
    required: false,
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({
    description: 'Number of hospitals to compare',
    example: 10,
    required: false,
    minimum: 1,
    maximum: 50,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class AnalyticsQueryDto {
  @ApiProperty({
    description: 'Filter by service type',
    example: 'MRI',
    required: false,
  })
  @IsOptional()
  @IsString()
  service?: string;

  @ApiProperty({
    description: 'Filter by state',
    example: 'CA',
    required: false,
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({
    description: 'Time period (30d, 90d, 1y)',
    example: '30d',
    required: false,
    enum: ['30d', '90d', '1y'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['30d', '90d', '1y'])
  period?: string;
}

export class ExportQueryDto {
  @ApiProperty({
    description: 'Export format - csv: Comma-separated values, json: JSON format, excel: Excel spreadsheet, parquet: Columnar format',
    example: 'csv',
    required: false,
    enum: ['csv', 'json', 'excel', 'parquet'],
    default: 'csv',
  })
  @IsOptional()
  @IsString()
  @IsIn(['csv', 'json', 'excel', 'parquet'], {
    message: 'Format must be one of: csv, json, excel, parquet'
  })
  format?: string;

  @ApiProperty({
    description: 'Dataset to export - hospitals: Hospital information, prices: Price data, analytics: Analytics data, all: All datasets combined',
    example: 'hospitals',
    required: false,
    enum: ['hospitals', 'prices', 'analytics', 'all'],
    default: 'hospitals',
  })
  @IsOptional()
  @IsString()
  @IsIn(['hospitals', 'prices', 'analytics', 'all'], {
    message: 'Dataset must be one of: hospitals, prices, analytics, all'
  })
  dataset?: string;

  @ApiProperty({
    description: 'Maximum number of records to export (1-100000)',
    example: 1000,
    required: false,
    minimum: 1,
    maximum: 100000,
    default: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100000, { message: 'Limit cannot exceed 100,000 records' })
  @Type(() => Number)
  limit?: number;
}

export class ODataQueryDto {
  @ApiProperty({
    description: 'Select specific fields',
    example: 'name,address,state',
    required: false,
  })
  @IsOptional()
  @IsString()
  $select?: string;

  @ApiProperty({
    description: 'Filter criteria',
    example: 'state eq \'CA\'',
    required: false,
  })
  @IsOptional()
  @IsString()
  $filter?: string;

  @ApiProperty({
    description: 'Sort order',
    example: 'name asc',
    required: false,
  })
  @IsOptional()
  @IsString()
  $orderby?: string;

  @ApiProperty({
    description: 'Number of records to return',
    example: '10',
    required: false,
  })
  @IsOptional()
  @IsString()
  $top?: string;

  @ApiProperty({
    description: 'Number of records to skip',
    example: '0',
    required: false,
  })
  @IsOptional()
  @IsString()
  $skip?: string;

  @ApiProperty({
    description: 'Include count',
    example: 'true',
    required: false,
  })
  @IsOptional()
  @IsString()
  $count?: string;
}