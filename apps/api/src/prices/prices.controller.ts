import { Controller, Get, Query, Param, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { PricesService } from './prices.service';
import { PriceFilterQueryDto, PriceComparisonQueryDto, AnalyticsQueryDto } from '../common/dto/query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Prices')
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

  @Get('search/zipcode')
  @RequirePermissions('prices:read')
  @ApiOperation({ summary: 'Search prices by zipcode' })
  @ApiResponse({ status: 200, description: 'Prices retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Authentication required' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid parameters' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiQuery({ name: 'zipcode', required: true, description: 'Zipcode to search around' })
  @ApiQuery({ name: 'radius', required: false, description: 'Search radius in miles (default: 10)' })
  @ApiQuery({ name: 'serviceCode', required: false, description: 'Filter by service code' })
  @ApiQuery({ name: 'serviceName', required: false, description: 'Filter by service name' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category' })
  @ApiQuery({ name: 'includeNegotiatedRates', required: false, description: 'Include only prices with negotiated rates' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results to return (default: 50)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of results to skip (default: 0)' })
  async searchPricesByZipcode(
    @Query('zipcode') zipcode: string,
    @Query('radius') radius?: number,
    @Query('serviceCode') serviceCode?: string,
    @Query('serviceName') serviceName?: string,
    @Query('category') category?: string,
    @Query('includeNegotiatedRates') includeNegotiatedRates?: string | boolean,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    try {
      if (!zipcode) {
        throw new HttpException(
          { 
            message: 'Zipcode is required',
            statusCode: HttpStatus.BAD_REQUEST,
            error: 'Bad Request' 
          },
          HttpStatus.BAD_REQUEST
        );
      }

      return await this.pricesService.searchPricesByZipcode({
        zipcode,
        radius: radius ? Number(radius) : undefined,
        serviceCode,
        serviceName,
        category,
        includeNegotiatedRates: includeNegotiatedRates === 'true' || includeNegotiatedRates === true,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });
    } catch (error) {
      if (error.status === HttpStatus.BAD_REQUEST) {
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
          message: 'Internal server error occurred while searching prices',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error' 
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('hospital/:hospitalId')
  @RequirePermissions('prices:read')
  @ApiOperation({ summary: 'Get prices for a specific hospital' })
  @ApiResponse({ status: 200, description: 'Hospital prices retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Authentication required' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Hospital not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiParam({ name: 'hospitalId', description: 'Hospital ID' })
  @ApiQuery({ name: 'serviceCode', required: false, description: 'Filter by service code' })
  @ApiQuery({ name: 'serviceName', required: false, description: 'Filter by service name' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category' })
  @ApiQuery({ name: 'codeType', required: false, description: 'Filter by code type (CPT, DRG, HCPCS, etc.)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of results to return (default: 50)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Number of results to skip (default: 0)' })
  async getHospitalPrices(
    @Param('hospitalId') hospitalId: string,
    @Query('serviceCode') serviceCode?: string,
    @Query('serviceName') serviceName?: string,
    @Query('category') category?: string,
    @Query('codeType') codeType?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    try {
      return await this.pricesService.getHospitalPrices(hospitalId, {
        serviceCode,
        serviceName,
        category,
        codeType,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });
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
          message: 'Internal server error occurred while fetching hospital prices',
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
