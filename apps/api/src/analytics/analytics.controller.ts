import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto, ExportQueryDto } from '../common/dto/query.dto';

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
  async getPricingTrends(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getPricingTrends(query);
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
  async exportData(@Query() query: ExportQueryDto) {
    return this.analyticsService.exportData(query);
  }
}
