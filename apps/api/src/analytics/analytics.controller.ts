import { Controller, Get, Query, UseGuards, Res, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
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
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({ status: 503, description: 'Service unavailable - database connection failed' })
  @Roles('admin', 'api-user')
  async getDashboardAnalytics() {
    try {
      return await this.analyticsService.getDashboardAnalytics();
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
          message: 'Internal server error occurred while fetching dashboard analytics',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error' 
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('trends')
  @Throttle({ expensive: { limit: 10, ttl: 900000 } })
  @ApiOperation({ summary: 'Get pricing trends' })
  @ApiResponse({ status: 200, description: 'Pricing trends retrieved successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({ status: 503, description: 'Service unavailable - database connection failed' })
  @ApiQuery({ name: 'service', required: false, description: 'Filter by service type' })
  @ApiQuery({ name: 'state', required: false, description: 'Filter by state' })
  @ApiQuery({ name: 'period', required: false, description: 'Time period (30d, 90d, 1y)' })
  @Roles('admin', 'api-user')
  async getPricingTrends(@Query() query: AnalyticsQueryDto) {
    try {
      return await this.analyticsService.getPricingTrends(query);
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
          message: 'Internal server error occurred while fetching pricing trends',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error' 
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('powerbi')
  @ApiOperation({ summary: 'Get PowerBI dataset summary' })
  @ApiResponse({ status: 200, description: 'PowerBI dataset information retrieved successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({ status: 503, description: 'Service unavailable - database connection failed' })
  @Roles('admin', 'api-user')
  async getPowerBIInfo() {
    try {
      return await this.analyticsService.getPowerBIInfo();
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
          message: 'Internal server error occurred while fetching PowerBI info',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error' 
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('export')
  @Throttle({ expensive: { limit: 5, ttl: 900000 } })
  @ApiOperation({ summary: 'Export analytics data (initiate export job)' })
  @ApiResponse({ status: 200, description: 'Analytics data export job initiated successfully' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({ status: 503, description: 'Service unavailable - database connection failed' })
  @Roles('admin', 'api-user')
  async exportData(@Query() query: ExportQueryDto) {
    try {
      return await this.analyticsService.exportData(query);
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
          message: 'Internal server error occurred while exporting data',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error' 
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('export/stream')
  @Throttle({ expensive: { limit: 2, ttl: 900000 } })
  @ApiOperation({ summary: 'Stream analytics data export' })
  @ApiResponse({ status: 200, description: 'Analytics data streamed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid format or dataset' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({ status: 503, description: 'Service unavailable - database connection failed' })
  @Roles('admin', 'api-user')
  async streamExportData(@Query() query: ExportQueryDto, @Res() res: Response) {
    try {
      await this.analyticsService.streamExportData(query, res);
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
          message: 'Internal server error occurred while streaming export data',
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error' 
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
