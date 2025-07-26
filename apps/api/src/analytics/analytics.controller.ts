import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  Res,
  Param,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { AnalyticsService } from "./analytics.service";
import { FlexibleAuthGuard } from "../auth/guards/flexible-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { AnalyticsQueryDto, ExportQueryDto } from "../common/dto/query.dto";

@ApiTags("Analytics")
@Controller("analytics")
@ApiBearerAuth()
@UseGuards(FlexibleAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("dashboard")
  @Throttle({ expensive: { limit: 10, ttl: 900000 } })
  @ApiOperation({ summary: "Get dashboard analytics" })
  @ApiResponse({
    status: 200,
    description: "Dashboard analytics retrieved successfully",
  })
  @ApiResponse({ status: 500, description: "Internal server error" })
  @ApiResponse({
    status: 503,
    description: "Service unavailable - database connection failed",
  })
  @Roles("admin", "api-user")
  async getDashboardAnalytics() {
    try {
      return await this.analyticsService.getDashboardAnalytics();
    } catch (_error) {
      if (
        error.message?.includes("ECONNREFUSED") ||
        error.message?.includes("connect")
      ) {
        throw new HttpException(
          {
            message: "Database connection failed. Please try again later.",
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            error: "Service Unavailable",
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      throw new HttpException(
        {
          message:
            "Internal server error occurred while fetching dashboard analytics",
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: "Internal Server Error",
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("trends")
  @Throttle({ expensive: { limit: 10, ttl: 900000 } })
  @ApiOperation({ summary: "Get pricing trends" })
  @ApiResponse({
    status: 200,
    description: "Pricing trends retrieved successfully",
  })
  @ApiResponse({ status: 500, description: "Internal server error" })
  @ApiResponse({
    status: 503,
    description: "Service unavailable - database connection failed",
  })
  @ApiQuery({
    name: "service",
    required: false,
    description: "Filter by service type",
  })
  @ApiQuery({ name: "state", required: false, description: "Filter by state" })
  @ApiQuery({
    name: "period",
    required: false,
    description: "Time period (30d, 90d, 1y)",
  })
  @Roles("admin", "api-user")
  async getPricingTrends(@Query() query: AnalyticsQueryDto) {
    try {
      return await this.analyticsService.getPricingTrends(query);
    } catch (_error) {
      if (
        error.message?.includes("ECONNREFUSED") ||
        error.message?.includes("connect")
      ) {
        throw new HttpException(
          {
            message: "Database connection failed. Please try again later.",
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            error: "Service Unavailable",
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      throw new HttpException(
        {
          message:
            "Internal server error occurred while fetching pricing trends",
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: "Internal Server Error",
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("powerbi")
  @ApiOperation({ summary: "Get PowerBI dataset summary" })
  @ApiResponse({
    status: 200,
    description: "PowerBI dataset information retrieved successfully",
  })
  @ApiResponse({ status: 500, description: "Internal server error" })
  @ApiResponse({
    status: 503,
    description: "Service unavailable - database connection failed",
  })
  @Roles("admin", "api-user")
  async getPowerBIInfo() {
    try {
      return await this.analyticsService.getPowerBIInfo();
    } catch (_error) {
      if (
        error.message?.includes("ECONNREFUSED") ||
        error.message?.includes("connect")
      ) {
        throw new HttpException(
          {
            message: "Database connection failed. Please try again later.",
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            error: "Service Unavailable",
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      throw new HttpException(
        {
          message: "Internal server error occurred while fetching PowerBI info",
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: "Internal Server Error",
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("export")
  @Throttle({ expensive: { limit: 5, ttl: 900000 } })
  @ApiOperation({
    summary: "Export analytics data with format validation and size limits",
  })
  @ApiResponse({
    status: 200,
    description: "Analytics data export prepared successfully",
  })
  @ApiResponse({ status: 400, description: "Invalid export parameters" })
  @ApiResponse({ status: 500, description: "Internal server error" })
  @ApiResponse({
    status: 503,
    description: "Service unavailable - database connection failed",
  })
  @Roles("admin", "api-user")
  async exportData(@Query() query: ExportQueryDto) {
    try {
      return await this.analyticsService.exportData(query);
    } catch (_error) {
      if (
        error.message?.includes("ECONNREFUSED") ||
        error.message?.includes("connect")
      ) {
        throw new HttpException(
          {
            message: "Database connection failed. Please try again later.",
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            error: "Service Unavailable",
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      if (
        error.message?.includes("Invalid format") ||
        error.message?.includes("Invalid dataset") ||
        error.message?.includes("exceeds maximum")
      ) {
        throw new HttpException(
          {
            message: error.message,
            statusCode: HttpStatus.BAD_REQUEST,
            error: "Bad Request",
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(
        {
          message: "Internal server error occurred while exporting data",
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: "Internal Server Error",
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("export/download")
  @Throttle({ expensive: { limit: 3, ttl: 1800000 } }) // 3 requests per 30 minutes
  @ApiOperation({
    summary: "Download analytics data with streaming for small exports",
  })
  @ApiResponse({
    status: 200,
    description: "Analytics data streamed successfully",
  })
  @ApiResponse({ status: 400, description: "Invalid export parameters" })
  @ApiResponse({ status: 500, description: "Internal server error" })
  @Roles("admin", "api-user")
  async downloadExportData(
    @Query() query: ExportQueryDto,
    @Res() response: Response,
  ) {
    try {
      // Only allow streaming for small exports (under 10MB/10k records)
      const limit = query.limit || 1000;
      if (limit > 10000) {
        throw new HttpException(
          {
            message:
              "Direct download is limited to 10,000 records. Use the /export endpoint for larger datasets.",
            statusCode: HttpStatus.BAD_REQUEST,
            error: "Bad Request",
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.analyticsService.streamExportData(query, response);
    } catch (_error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (
        error.message?.includes("ECONNREFUSED") ||
        error.message?.includes("connect")
      ) {
        throw new HttpException(
          {
            message: "Database connection failed. Please try again later.",
            statusCode: HttpStatus.SERVICE_UNAVAILABLE,
            error: "Service Unavailable",
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      if (
        error.message?.includes("Invalid format") ||
        error.message?.includes("Invalid dataset")
      ) {
        throw new HttpException(
          {
            message: error.message,
            statusCode: HttpStatus.BAD_REQUEST,
            error: "Bad Request",
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(
        {
          message: "Internal server error occurred while streaming export data",
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: "Internal Server Error",
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("export/:exportId/status")
  @ApiOperation({ summary: "Get export progress status" })
  @ApiResponse({
    status: 200,
    description: "Export status retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "Export not found" })
  @Roles("admin", "api-user")
  async getExportStatus(@Param("exportId") exportId: string) {
    const progress = await this.analyticsService.getExportProgress(exportId);
    if (!progress) {
      throw new HttpException(
        {
          message: "Export not found",
          statusCode: HttpStatus.NOT_FOUND,
          error: "Not Found",
        },
        HttpStatus.NOT_FOUND,
      );
    }
    return progress;
  }

  @Get("exports")
  @ApiOperation({ summary: "Get all export history and status" })
  @ApiResponse({
    status: 200,
    description: "Export history retrieved successfully",
  })
  @Roles("admin", "api-user")
  getAllExports() {
    return this.analyticsService.getAllExportProgress();
  }

  // Enhanced Analytics Endpoints
  @Get("metrics/comprehensive")
  @Throttle({ expensive: { limit: 5, ttl: 600000 } }) // 5 requests per 10 minutes
  @ApiOperation({ summary: "Get comprehensive pre-computed analytics metrics" })
  @ApiResponse({
    status: 200,
    description: "Comprehensive metrics retrieved successfully",
  })
  @ApiQuery({
    name: "period",
    required: false,
    description: "Time period (month, quarter, year)",
  })
  @ApiQuery({ name: "state", required: false, description: "Filter by state" })
  @Roles("admin", "api-user")
  async getComprehensiveMetrics(
    @Query() query: { period?: string; state?: string },
  ) {
    try {
      return await this.analyticsService.getComprehensiveMetrics(query);
    } catch (_error) {
      throw new HttpException(
        {
          message: "Failed to retrieve comprehensive metrics",
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: "Internal Server Error",
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("insights/price-variance")
  @Throttle({ expensive: { limit: 10, ttl: 900000 } })
  @ApiOperation({ summary: "Get price variance and outlier analysis" })
  @ApiResponse({
    status: 200,
    description: "Price variance insights retrieved successfully",
  })
  @ApiQuery({
    name: "service",
    required: false,
    description: "Filter by service name",
  })
  @ApiQuery({ name: "state", required: false, description: "Filter by state" })
  @Roles("admin", "api-user")
  async getPriceVarianceInsights(
    @Query() query: { service?: string; state?: string },
  ) {
    try {
      return await this.analyticsService.getPriceVarianceInsights(query);
    } catch (_error) {
      throw new HttpException(
        {
          message: "Failed to retrieve price variance insights",
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: "Internal Server Error",
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("insights/market-position")
  @Throttle({ expensive: { limit: 10, ttl: 900000 } })
  @ApiOperation({ summary: "Get hospital market position analysis" })
  @ApiResponse({
    status: 200,
    description: "Market position insights retrieved successfully",
  })
  @ApiQuery({
    name: "hospitalId",
    required: false,
    description: "Specific hospital ID",
  })
  @ApiQuery({ name: "state", required: false, description: "Filter by state" })
  @Roles("admin", "api-user")
  async getMarketPositionInsights(
    @Query() query: { hospitalId?: string; state?: string },
  ) {
    try {
      return await this.analyticsService.getMarketPositionInsights(query);
    } catch (_error) {
      throw new HttpException(
        {
          message: "Failed to retrieve market position insights",
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: "Internal Server Error",
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("benchmarks")
  @Throttle({ expensive: { limit: 10, ttl: 900000 } })
  @ApiOperation({ summary: "Get industry benchmarks and comparisons" })
  @ApiResponse({
    status: 200,
    description: "Benchmarks retrieved successfully",
  })
  @ApiQuery({
    name: "metric",
    required: false,
    description: "Specific metric to benchmark",
  })
  @ApiQuery({ name: "state", required: false, description: "Filter by state" })
  @Roles("admin", "api-user")
  async getBenchmarks(@Query() query: { metric?: string; state?: string }) {
    try {
      return await this.analyticsService.getBenchmarks(query);
    } catch (_error) {
      throw new HttpException(
        {
          message: "Failed to retrieve benchmarks",
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: "Internal Server Error",
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("real-time-metrics")
  @Throttle({ expensive: { limit: 20, ttl: 300000 } }) // 20 requests per 5 minutes
  @ApiOperation({ summary: "Get real-time dashboard metrics" })
  @ApiResponse({
    status: 200,
    description: "Real-time metrics retrieved successfully",
  })
  @Roles("admin", "api-user")
  async getRealTimeMetrics() {
    try {
      return await this.analyticsService.getRealTimeMetrics();
    } catch (_error) {
      throw new HttpException(
        {
          message: "Failed to retrieve real-time metrics",
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: "Internal Server Error",
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
