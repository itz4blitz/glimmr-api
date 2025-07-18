import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { HospitalsService } from './hospitals.service.js';
import { ErrorResponseDto } from '../common/exceptions';

@ApiTags('hospitals')
@Controller('hospitals')
export class HospitalsController {
  constructor(private readonly hospitalsService: HospitalsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all hospitals' })
  @ApiResponse({ status: 200, description: 'List of hospitals retrieved successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error', type: ErrorResponseDto })
  @ApiQuery({ name: 'state', required: false, description: 'Filter by state' })
  @ApiQuery({ name: 'city', required: false, description: 'Filter by city' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results to return' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of results to skip' })
  async getHospitals(
    @Query('state') state?: string,
    @Query('city') city?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.hospitalsService.getHospitals({ state, city, limit, offset });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get hospital by ID' })
  @ApiResponse({ status: 200, description: 'Hospital retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Hospital not found', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Internal server error', type: ErrorResponseDto })
  @ApiParam({ name: 'id', description: 'Hospital ID' })
  async getHospitalById(@Param('id') id: string) {
    return this.hospitalsService.getHospitalById(id);
  }

  @Get(':id/prices')
  @ApiOperation({ summary: 'Get pricing data for a hospital' })
  @ApiResponse({ status: 200, description: 'Hospital pricing data retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Hospital not found', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Internal server error', type: ErrorResponseDto })
  @ApiParam({ name: 'id', description: 'Hospital ID' })
  @ApiQuery({ name: 'service', required: false, description: 'Filter by service type' })
  async getHospitalPrices(
    @Param('id') id: string,
    @Query('service') service?: string,
  ) {
    return this.hospitalsService.getHospitalPrices(id, { service });
  }


}
