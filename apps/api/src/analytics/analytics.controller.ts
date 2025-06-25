import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard analytics' })
  @ApiResponse({ status: 200, description: 'Dashboard analytics retrieved successfully' })
  async getDashboardAnalytics() {
    return this.analyticsService.getDashboardAnalytics();
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get pricing trends' })
  @ApiResponse({ status: 200, description: 'Pricing trends retrieved successfully' })
  @ApiQuery({ name: 'service', required: false, description: 'Filter by service type' })
  @ApiQuery({ name: 'state', required: false, description: 'Filter by state' })
  @ApiQuery({ name: 'period', required: false, description: 'Time period (30d, 90d, 1y)' })
  async getPricingTrends(
    @Query('service') service?: string,
    @Query('state') state?: string,
    @Query('period') period?: string,
  ) {
    return this.analyticsService.getPricingTrends({ service, state, period });
  }

  @Get('powerbi')
  @ApiOperation({ summary: 'Get PowerBI dataset summary' })
  @ApiResponse({ status: 200, description: 'PowerBI dataset information retrieved successfully' })
  async getPowerBIInfo() {
    return this.analyticsService.getPowerBIInfo();
  }

  @Get('export')
  @ApiOperation({ summary: 'Export analytics data' })
  @ApiResponse({ status: 200, description: 'Analytics data export prepared successfully' })
  @ApiQuery({ name: 'format', required: false, description: 'Export format (csv, json, excel)' })
  @ApiQuery({ name: 'dataset', required: false, description: 'Dataset to export (hospitals, prices, analytics)' })
  async exportData(
    @Query('format') format?: string,
    @Query('dataset') dataset?: string,
  ) {
    return this.analyticsService.exportData({ format, dataset });
  }
}
