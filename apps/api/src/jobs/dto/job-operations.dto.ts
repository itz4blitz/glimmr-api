import { ApiProperty } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  IsEnum as _IsEnum,
  IsDateString,
  IsObject,
  ValidateNested,
  Min,
  Max,
  ArrayMinSize,
  ArrayMaxSize,
  IsIn,
  IsUUID,
} from "class-validator";
import { Transform, Type } from "class-transformer";

// Enhanced job filtering DTO
export class JobAdvancedFilterDto {
  @ApiProperty({
    description: "Search by job name or ID",
    example: "price-update",
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: "Filter by job status",
    example: ["completed", "failed"],
    required: false,
    isArray: true,
    enum: ["waiting", "active", "completed", "failed", "delayed", "paused"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(["waiting", "active", "completed", "failed", "delayed", "paused"], {
    each: true,
  })
  status?: string[];

  @ApiProperty({
    description: "Filter by queue name",
    example: ["price-file-parser", "analytics-refresh"],
    required: false,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  queues?: string[];

  @ApiProperty({
    description: "Filter by date range - start date",
    example: "2024-01-01T00:00:00Z",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: "Filter by date range - end date",
    example: "2024-12-31T23:59:59Z",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: "Filter by minimum duration (ms)",
    example: 1000,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minDuration?: number;

  @ApiProperty({
    description: "Filter by maximum duration (ms)",
    example: 60000,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxDuration?: number;

  @ApiProperty({
    description: "Filter by priority",
    example: [1, 2, 3],
    required: false,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsNumber({}, { each: true })
  priorities?: number[];

  @ApiProperty({
    description: "Include job data in response",
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  includeData?: boolean;

  @ApiProperty({
    description: "Page number for pagination",
    example: 1,
    required: false,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiProperty({
    description: "Number of results per page",
    example: 20,
    required: false,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({
    description: "Sort field",
    example: "createdAt",
    required: false,
    enum: ["createdAt", "completedAt", "duration", "priority", "name"],
    default: "createdAt",
  })
  @IsOptional()
  @IsString()
  @IsIn(["createdAt", "completedAt", "duration", "priority", "name"])
  sortBy?: string;

  @ApiProperty({
    description: "Sort order",
    example: "desc",
    required: false,
    enum: ["asc", "desc"],
    default: "desc",
  })
  @IsOptional()
  @IsString()
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc";
}

// Bulk operations DTOs
export class BulkJobOperationDto {
  @ApiProperty({
    description: "Job IDs to operate on",
    example: ["job-123", "job-456", "job-789"],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  jobIds: string[];

  @ApiProperty({
    description: "Queue names for the jobs (optional, for validation)",
    example: ["price-file-parser"],
    required: false,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  queues?: string[];
}

// Schedule management DTOs
export class CreateJobScheduleDto {
  @ApiProperty({
    description: "Schedule name",
    example: "Daily Analytics Refresh",
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: "Schedule description",
    example: "Refreshes analytics data daily at 2 AM",
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: "Job template ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsUUID()
  templateId: string;

  @ApiProperty({
    description: "Cron expression",
    example: "0 2 * * *",
  })
  @IsString()
  cronExpression: string;

  @ApiProperty({
    description: "Timezone for the schedule",
    example: "America/New_York",
    required: false,
    default: "UTC",
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({
    description: "Job priority override",
    example: 5,
    required: false,
    minimum: -100,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  @Max(100)
  priority?: number;

  @ApiProperty({
    description: "Job timeout override (ms)",
    example: 300000,
    required: false,
    minimum: 1000,
    maximum: 3600000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1000)
  @Max(3600000)
  timeout?: number;

  @ApiProperty({
    description: "Retry attempts override",
    example: 3,
    required: false,
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  retryAttempts?: number;

  @ApiProperty({
    description: "Retry delay override (ms)",
    example: 60000,
    required: false,
    minimum: 1000,
    maximum: 600000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1000)
  @Max(600000)
  retryDelay?: number;

  @ApiProperty({
    description: "Job configuration override",
    example: { batchSize: 100, forceRefresh: true },
    required: false,
  })
  @IsOptional()
  @IsObject()
  jobConfig?: Record<string, unknown>;

  @ApiProperty({
    description: "Whether the schedule is enabled",
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  isEnabled?: boolean;

  @ApiProperty({
    description: "Maximum consecutive failures before disabling",
    example: 5,
    required: false,
    minimum: 1,
    maximum: 50,
    default: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  maxConsecutiveFailures?: number;

  @ApiProperty({
    description: "Disable schedule on max failures",
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  disableOnMaxFailures?: boolean;
}

export class UpdateJobScheduleDto {
  @ApiProperty({
    description: "Schedule name",
    example: "Daily Analytics Refresh",
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: "Schedule description",
    example: "Refreshes analytics data daily at 2 AM",
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: "Cron expression",
    example: "0 2 * * *",
    required: false,
  })
  @IsOptional()
  @IsString()
  cronExpression?: string;

  @ApiProperty({
    description: "Timezone for the schedule",
    example: "America/New_York",
    required: false,
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty({
    description: "Job priority override",
    example: 5,
    required: false,
    minimum: -100,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  @Max(100)
  priority?: number;

  @ApiProperty({
    description: "Job timeout override (ms)",
    example: 300000,
    required: false,
    minimum: 1000,
    maximum: 3600000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1000)
  @Max(3600000)
  timeout?: number;

  @ApiProperty({
    description: "Retry attempts override",
    example: 3,
    required: false,
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10)
  retryAttempts?: number;

  @ApiProperty({
    description: "Retry delay override (ms)",
    example: 60000,
    required: false,
    minimum: 1000,
    maximum: 600000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1000)
  @Max(600000)
  retryDelay?: number;

  @ApiProperty({
    description: "Job configuration override",
    example: { batchSize: 100, forceRefresh: true },
    required: false,
  })
  @IsOptional()
  @IsObject()
  jobConfig?: Record<string, unknown>;

  @ApiProperty({
    description: "Whether the schedule is enabled",
    example: true,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  isEnabled?: boolean;

  @ApiProperty({
    description: "Maximum consecutive failures before disabling",
    example: 5,
    required: false,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  maxConsecutiveFailures?: number;

  @ApiProperty({
    description: "Disable schedule on max failures",
    example: true,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  disableOnMaxFailures?: boolean;
}

// Export DTOs
export class JobExportDto {
  @ApiProperty({
    description: "Export format",
    example: "csv",
    enum: ["csv", "json", "excel"],
    default: "csv",
  })
  @IsOptional()
  @IsString()
  @IsIn(["csv", "json", "excel"])
  format?: "csv" | "json" | "excel";

  @ApiProperty({
    description: "Filter options for export",
    required: false,
  })
  @IsOptional()
  @Type(() => JobAdvancedFilterDto)
  @ValidateNested()
  filters?: JobAdvancedFilterDto;

  @ApiProperty({
    description: "Fields to include in export",
    example: ["id", "name", "status", "createdAt", "duration"],
    required: false,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fields?: string[];

  @ApiProperty({
    description: "Include job data in export",
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  includeData?: boolean;

  @ApiProperty({
    description: "Include logs in export",
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  includeLogs?: boolean;
}

// Analytics query DTOs
export class JobAnalyticsQueryDto {
  @ApiProperty({
    description: "Time range for analytics",
    example: "24h",
    enum: ["1h", "6h", "12h", "24h", "7d", "30d"],
    default: "24h",
  })
  @IsOptional()
  @IsString()
  @IsIn(["1h", "6h", "12h", "24h", "7d", "30d"])
  timeRange?: string;

  @ApiProperty({
    description: "Group by field",
    example: "queue",
    enum: ["queue", "status", "hour", "day"],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(["queue", "status", "hour", "day"])
  groupBy?: string;

  @ApiProperty({
    description: "Queue names to filter",
    example: ["price-file-parser", "analytics-refresh"],
    required: false,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  queues?: string[];

  @ApiProperty({
    description: "Include detailed metrics",
    example: true,
    required: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  detailed?: boolean;
}

// Resource monitoring DTOs
export class ResourceUsageQueryDto {
  @ApiProperty({
    description: "Time range for resource usage",
    example: "1h",
    enum: ["5m", "15m", "30m", "1h", "6h", "12h", "24h"],
    default: "1h",
  })
  @IsOptional()
  @IsString()
  @IsIn(["5m", "15m", "30m", "1h", "6h", "12h", "24h"])
  timeRange?: string;

  @ApiProperty({
    description: "Resource type to monitor",
    example: ["cpu", "memory"],
    enum: ["cpu", "memory", "redis", "database"],
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(["cpu", "memory", "redis", "database"], { each: true })
  resources?: string[];

  @ApiProperty({
    description: "Include predictions",
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  includePredictions?: boolean;
}
