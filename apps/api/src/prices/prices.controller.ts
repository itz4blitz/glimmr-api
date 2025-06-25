import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { PricesService } from './prices.service';

@ApiTags('prices')
@Controller('prices')
export class PricesController {
  constructor(private readonly pricesService: PricesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all pricing data' })
  @ApiResponse({ status: 200, description: 'Pricing data retrieved successfully' })
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
    return this.pricesService.getPrices({
      hospital,
      service,
      state,
      minPrice,
      maxPrice,
      limit,
      offset,
    });
  }

  @Get('compare')
  @ApiOperation({ summary: 'Compare prices across hospitals' })
  @ApiResponse({ status: 200, description: 'Price comparison data retrieved successfully' })
  @ApiQuery({ name: 'service', required: true, description: 'Service to compare' })
  @ApiQuery({ name: 'state', required: false, description: 'Filter by state' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of hospitals to compare' })
  async comparePrices(
    @Query('service') service: string,
    @Query('state') state?: string,
    @Query('limit') limit?: number,
  ) {
    return this.pricesService.comparePrices({ service, state, limit });
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get pricing analytics' })
  @ApiResponse({ status: 200, description: 'Pricing analytics retrieved successfully' })
  @ApiQuery({ name: 'service', required: false, description: 'Filter by service type' })
  @ApiQuery({ name: 'state', required: false, description: 'Filter by state' })
  async getPricingAnalytics(
    @Query('service') service?: string,
    @Query('state') state?: string,
  ) {
    return this.pricesService.getPricingAnalytics({ service, state });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get price by ID' })
  @ApiResponse({ status: 200, description: 'Price retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Price not found' })
  @ApiParam({ name: 'id', description: 'Price ID' })
  async getPriceById(@Param('id') id: string) {
    return this.pricesService.getPriceById(id);
  }
}
