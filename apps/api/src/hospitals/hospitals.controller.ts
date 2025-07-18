import { Controller, Get, Query, Param, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { HospitalsService } from './hospitals.service';
import { ErrorResponseDto } from '../common/exceptions';
import { HospitalFilterQueryDto } from '../common/dto/query.dto';

@ApiTags('hospitals')
@Controller('hospitals')
export class HospitalsController {
  constructor(private readonly hospitalsService: HospitalsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all hospitals' })
  @ApiResponse({ status: 200, description: 'List of hospitals retrieved successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({ status: 503, description: 'Service unavailable - database connection failed' })
  @ApiResponse({ status: 500, description: 'Internal server error', type: ErrorResponseDto })
  @ApiQuery({ name: 'state', required: false, description: 'Filter by state' })
  @ApiQuery({ name: 'city', required: false, description: 'Filter by city' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results to return' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of results to skip' })
  async getHospitals(@Query() query: HospitalFilterQueryDto) {
    try {
      return await this.hospitalsService.getHospitals(query);
    } catch (error) {
      if (error.message?.includes('ECONNREFUSED') || error.message?.includes('connect')) {
        throw new HttpException(
          { 
            message: 'Database connection failed. Please try again later.',
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            error: 'Service Unavailable' 
          },
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
      throw new HttpException(
        { 
          message: 'Internal server error occurred while fetching hospitals',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error' 
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get hospital by ID' })
  @ApiResponse({ status: 200, description: 'Hospital retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Hospital not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({ status: 503, description: 'Service unavailable - database connection failed' })
  @ApiResponse({ status: 404, description: 'Hospital not found', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Internal server error', type: ErrorResponseDto })
  @ApiParam({ name: 'id', description: 'Hospital ID' })
  async getHospitalById(@Param('id') id: string) {
    try {
      const result = await this.hospitalsService.getHospitalById(id);
      if (!result) {
        throw new HttpException(
          { 
            message: 'Hospital not found',
            statusCode: HttpStatus.NOT_FOUND,
            error: 'Not Found' 
          },
          HttpStatus.NOT_FOUND
        );
      }
      return result;
    } catch (error) {
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      if (error.message?.includes('ECONNREFUSED') || error.message?.includes('connect')) {
        throw new HttpException(
          { 
            message: 'Database connection failed. Please try again later.',
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            error: 'Service Unavailable' 
          },
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
      throw new HttpException(
        { 
          message: 'Internal server error occurred while fetching hospital',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error' 
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id/prices')
  @ApiOperation({ summary: 'Get pricing data for a hospital' })
  @ApiResponse({ status: 200, description: 'Hospital pricing data retrieved successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({ status: 503, description: 'Service unavailable - database connection failed' })
  @ApiResponse({ status: 404, description: 'Hospital not found', type: ErrorResponseDto })
  @ApiResponse({ status: 500, description: 'Internal server error', type: ErrorResponseDto })
  @ApiParam({ name: 'id', description: 'Hospital ID' })
  @ApiQuery({ name: 'service', required: false, description: 'Filter by service type' })
  async getHospitalPrices(
    @Param('id') id: string,
    @Query('service') service?: string,
  ) {
    try {
      return await this.hospitalsService.getHospitalPrices(id, { service });
    } catch (error) {
      if (error.message?.includes('ECONNREFUSED') || error.message?.includes('connect')) {
        throw new HttpException(
          { 
            message: 'Database connection failed. Please try again later.',
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            error: 'Service Unavailable' 
          },
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
      throw new HttpException(
        { 
          message: 'Internal server error occurred while fetching hospital prices',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error' 
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }


}
