import { Controller, Get, Query, Param, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { PricesService } from './prices.service';
import { PriceFilterQueryDto, PriceComparisonQueryDto, AnalyticsQueryDto } from '../common/dto/query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('prices')
@Controller('prices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PricesController {
  constructor(private readonly pricesService: PricesService) {}

  @Get()
  @RequirePermissions('prices:read')
  @ApiOperation({ summary: 'Get all pricing data' })
  @ApiResponse({ status: 200, description: 'Pricing data retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Authentication required' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({ status: 503, description: 'Service unavailable - database connection failed' })
  @ApiQuery({ name: 'hospital', required: false, description: 'Filter by hospital ID' })
  @ApiQuery({ name: 'service', required: false, description: 'Filter by service type' })
  @ApiQuery({ name: 'state', required: false, description: 'Filter by state' })
  @ApiQuery({ name: 'minPrice', required: false, description: 'Minimum price filter' })
  @ApiQuery({ name: 'maxPrice', required: false, description: 'Maximum price filter' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results to return' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of results to skip' })
  async getPrices(
    @Query('hospital') hospital?: string,
    @Query('service') service?: string,
    @Query('state') state?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    try {
      return await this.pricesService.getPrices({
        hospital,
        service,
        state,
        minPrice,
        maxPrice,
        limit,
        offset,
      });
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
          message: 'Internal server error occurred while fetching prices',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error' 
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('compare')
  @RequirePermissions('prices:read')
  @ApiOperation({ summary: 'Compare prices across hospitals' })
  @ApiResponse({ status: 200, description: 'Price comparison data retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Authentication required' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({ status: 503, description: 'Service unavailable - database connection failed' })
  @ApiQuery({ name: 'service', required: true, description: 'Service to compare' })
  @ApiQuery({ name: 'state', required: false, description: 'Filter by state' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of hospitals to compare' })
  async comparePrices(
    @Query('service') service: string,
    @Query('state') state?: string,
    @Query('limit') limit?: number,
  ) {
    try {
      return await this.pricesService.comparePrices({ service, state, limit });
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
          message: 'Internal server error occurred while comparing prices',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error' 
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('analytics')
  @RequirePermissions('prices:analytics')
  @ApiOperation({ summary: 'Get pricing analytics' })
  @ApiResponse({ status: 200, description: 'Pricing analytics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Authentication required' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({ status: 503, description: 'Service unavailable - database connection failed' })
  @ApiQuery({ name: 'service', required: false, description: 'Filter by service type' })
  @ApiQuery({ name: 'state', required: false, description: 'Filter by state' })
  async getPricingAnalytics(
    @Query('service') service?: string,
    @Query('state') state?: string,
  ) {
    try {
      return await this.pricesService.getPricingAnalytics({ service, state });
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
          message: 'Internal server error occurred while fetching pricing analytics',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error' 
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id')
  @RequirePermissions('prices:read')
  @ApiOperation({ summary: 'Get price by ID' })
  @ApiResponse({ status: 200, description: 'Price retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Authentication required' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Price not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({ status: 503, description: 'Service unavailable - database connection failed' })
  @ApiParam({ name: 'id', description: 'Price ID' })
  async getPriceById(@Param('id') id: string) {
    try {
      const result = await this.pricesService.getPriceById(id);
      if (!result) {
        throw new HttpException(
          { 
            message: 'Price not found',
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
          message: 'Internal server error occurred while fetching price',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error' 
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
