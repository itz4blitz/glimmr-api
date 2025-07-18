import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { FlexibleAuthGuard } from '../auth/guards/flexible-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnalyticsQueryDto, ExportQueryDto } from '../common/dto/query.dto';

@ApiTags('analytics')
@Controller('analytics')
@ApiBearerAuth()
@UseGuards(FlexibleAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Throttle({ expensive: { limit: 10, ttl: 900000 } })
  @ApiOperation({ summary: 'Get dashboard analytics' })
  @ApiResponse({ status: 200, description: 'Dashboard analytics retrieved successfully' })
  @Roles('admin', 'api-user')
  async getDashboardAnalytics() {
    return this.analyticsService.getDashboardAnalytics();
  }

  @Get('trends')
  @Throttle({ expensive: { limit: 10, ttl: 900000 } })
  @ApiOperation({ summary: 'Get pricing trends' })
  @ApiResponse({ status: 200, description: 'Pricing trends retrieved successfully' })
  @ApiQuery({ name: 'service', required: false, description: 'Filter by service type' })
  @ApiQuery({ name: 'state', required: false, description: 'Filter by state' })
  @ApiQuery({ name: 'period', required: false, description: 'Time period (30d, 90d, 1y)' })
  @Roles('admin', 'api-user')
  async getPricingTrends(
    @Query('service') service?: string,
    @Query('state') state?: string,
    @Query('period') period?: string,
  ) {
    return this.analyticsService.getPricingTrends({ service, state, period });
  async getPricingTrends(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getPricingTrends(query);
  }

  @Get('powerbi')
  @ApiOperation({ summary: 'Get PowerBI dataset summary' })
  @ApiResponse({ status: 200, description: 'PowerBI dataset information retrieved successfully' })
  @Roles('admin', 'api-user')
  async getPowerBIInfo() {
    return this.analyticsService.getPowerBIInfo();
  }

  @Get('export')
  @Throttle({ expensive: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Export analytics data' })
  @ApiResponse({ status: 200, description: 'Analytics data export prepared successfully' })
  @ApiQuery({ name: 'format', required: false, description: 'Export format (csv, json, excel)' })
  @ApiQuery({ name: 'dataset', required: false, description: 'Dataset to export (hospitals, prices, analytics)' })
  @Roles('admin', 'api-user')
  async exportData(
    @Query('format') format?: string,
    @Query('dataset') dataset?: string,
  ) {
    return this.analyticsService.exportData({ format, dataset });
  async exportData(@Query() query: ExportQueryDto) {
    return this.analyticsService.exportData(query);
  }
}
