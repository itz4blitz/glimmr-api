import {
  Controller,
  Get,
  Query,
  Param,
  HttpException,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { HospitalsService } from "./hospitals.service";
import { ErrorResponseDto } from "../common/exceptions";
import { HospitalFilterQueryDto } from "../common/dto/query.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Hospitals")
@Controller("hospitals")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HospitalsController {
  constructor(private readonly hospitalsService: HospitalsService) {}

  @Get()
  @RequirePermissions("hospitals:read")
  @ApiOperation({ summary: "Get all hospitals" })
  @ApiResponse({
    status: 200,
    description: "List of hospitals retrieved successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Authentication required",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions",
  })
  @ApiResponse({ status: 500, description: "Internal server error" })
  @ApiResponse({
    status: 503,
    description: "Service unavailable - database connection failed",
  })
  @ApiResponse({
    status: 500,
    description: "Internal server error",
    type: ErrorResponseDto,
  })
  @ApiQuery({ name: "state", required: false, description: "Filter by state" })
  @ApiQuery({ name: "city", required: false, description: "Filter by city" })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Number of results to return",
  })
  @ApiQuery({
    name: "offset",
    required: false,
    description: "Number of results to skip",
  })
  async getHospitals(@Query() _query: HospitalFilterQueryDto) {
    try {
      return await this.hospitalsService.getHospitals(_query);
    } catch (error) {
      if (
        (error as Error).message?.includes("ECONNREFUSED") ||
        (error as Error).message?.includes("connect")
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
          message: "Internal server error occurred while fetching hospitals",
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: "Internal Server Error",
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(":id")
  @RequirePermissions("hospitals:read")
  @ApiOperation({ summary: "Get hospital by ID" })
  @ApiResponse({ status: 200, description: "Hospital retrieved successfully" })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Authentication required",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions",
  })
  @ApiResponse({ status: 404, description: "Hospital not found" })
  @ApiResponse({ status: 500, description: "Internal server error" })
  @ApiResponse({
    status: 503,
    description: "Service unavailable - database connection failed",
  })
  @ApiResponse({
    status: 404,
    description: "Hospital not found",
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 500,
    description: "Internal server error",
    type: ErrorResponseDto,
  })
  @ApiParam({ name: "id", description: "Hospital ID" })
  async getHospitalById(@Param("id") id: string) {
    try {
      const _result = await this.hospitalsService.getHospitalById(id);
      if (!_result) {
        throw new HttpException(
          {
            message: "Hospital not found",
            statusCode: HttpStatus.NOT_FOUND,
            error: "Not Found",
          },
          HttpStatus.NOT_FOUND,
        );
      }
      return _result;
    } catch (error) {
      if ((error as { status?: number }).status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      if (
        (error as Error).message?.includes("ECONNREFUSED") ||
        (error as Error).message?.includes("connect")
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
          message: "Internal server error occurred while fetching hospital",
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: "Internal Server Error",
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


  @Get(":id/price-files")
  @RequirePermissions("hospitals:read")
  @ApiOperation({ summary: "Get price transparency files for a hospital" })
  @ApiResponse({
    status: 200,
    description: "Hospital price files retrieved successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Authentication required",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions",
  })
  @ApiResponse({ status: 404, description: "Hospital not found" })
  @ApiResponse({ status: 500, description: "Internal server error" })
  @ApiResponse({
    status: 503,
    description: "Service unavailable - database connection failed",
  })
  @ApiParam({ name: "id", description: "Hospital ID" })
  async getHospitalPriceFiles(@Param("id") id: string) {
    try {
      return await this.hospitalsService.getHospitalPriceFiles(id);
    } catch (error) {
      if (
        (error as Error).message?.includes("ECONNREFUSED") ||
        (error as Error).message?.includes("connect")
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
            "Internal server error occurred while fetching hospital price files",
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: "Internal Server Error",
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
