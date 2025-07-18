import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { PricesService } from './prices.service';
import { PriceFilterQueryDto, PriceComparisonQueryDto, AnalyticsQueryDto } from '../common/dto/query.dto';

@ApiTags('prices')
@Controller('prices')
export class PricesController {
  constructor(private readonly pricesService: PricesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all pricing data' })
  @ApiResponse({ status: 200, description: 'Pricing data retrieved successfully' })
  async getPrices(@Query() query: PriceFilterQueryDto) {
    return this.pricesService.getPrices(query);
  }

  @Get('compare')
  @ApiOperation({ summary: 'Compare prices across hospitals' })
  @ApiResponse({ status: 200, description: 'Price comparison data retrieved successfully' })
  async comparePrices(@Query() query: PriceComparisonQueryDto) {
    return this.pricesService.comparePrices(query);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get pricing analytics' })
  @ApiResponse({ status: 200, description: 'Pricing analytics retrieved successfully' })
  async getPricingAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.pricesService.getPricingAnalytics(query);
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
