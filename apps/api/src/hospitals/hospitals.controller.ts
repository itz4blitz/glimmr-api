import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { HospitalsService } from './hospitals.service';
import { HospitalFilterQueryDto } from '../common/dto/query.dto';

@ApiTags('hospitals')
@Controller('hospitals')
export class HospitalsController {
  constructor(private readonly hospitalsService: HospitalsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all hospitals' })
  @ApiResponse({ status: 200, description: 'List of hospitals retrieved successfully' })
  async getHospitals(@Query() query: HospitalFilterQueryDto) {
    return this.hospitalsService.getHospitals(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get hospital by ID' })
  @ApiResponse({ status: 200, description: 'Hospital retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Hospital not found' })
  @ApiParam({ name: 'id', description: 'Hospital ID' })
  async getHospitalById(@Param('id') id: string) {
    return this.hospitalsService.getHospitalById(id);
  }

  @Get(':id/prices')
  @ApiOperation({ summary: 'Get pricing data for a hospital' })
  @ApiResponse({ status: 200, description: 'Hospital pricing data retrieved successfully' })
  @ApiParam({ name: 'id', description: 'Hospital ID' })
  @ApiQuery({ name: 'service', required: false, description: 'Filter by service type' })
  async getHospitalPrices(
    @Param('id') id: string,
    @Query('service') service?: string,
  ) {
    return this.hospitalsService.getHospitalPrices(id, { service });
  }


}
