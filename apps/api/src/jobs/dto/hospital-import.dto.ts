import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsNumber, Min, Max } from 'class-validator';

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
