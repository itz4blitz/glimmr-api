import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  NotFoundException,
  BadRequestException,
  ParseUUIDPipe,
  Res,
  StreamableFile,
} from "@nestjs/common";
import { Response } from "express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiProperty,
} from "@nestjs/swagger";
import { IsOptional, IsString, IsIn } from "class-validator";
import { Type } from "class-transformer";
// import { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import {
  UserManagementService,
  UserSearchFilters,
  UserListOptions,
} from "./user-management.service";
import {
  ProfileService,
} from "./profile.service";

// DTOs for API documentation and validation
export class UpdateUserDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  isActive?: boolean;
  emailVerified?: boolean;
}

export class UpdateUserRoleDto {
  role: "user" | "admin" | "super_admin";
}

export class BulkUserActionDto {
  userIds: string[];
  action: "activate" | "deactivate" | "delete";
  role?: "user" | "admin" | "super_admin";
}

export class UserListQueryDto {
  @ApiProperty({ description: "Page number", required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({ description: "Items per page", required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiProperty({
    description: "Sort field",
    required: false,
    enum: ["email", "firstName", "lastName", "createdAt", "lastLoginAt"],
    default: "createdAt",
  })
  @IsOptional()
  @IsIn(["email", "firstName", "lastName", "createdAt", "lastLoginAt"])
  sortBy?: "email" | "firstName" | "lastName" | "createdAt" | "lastLoginAt" =
    "createdAt";

  @ApiProperty({
    description: "Sort order",
    required: false,
    enum: ["asc", "desc"],
    default: "desc",
  })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc" = "desc";

  @ApiProperty({ description: "Search by username or email", required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ description: "Filter by role name", required: false })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiProperty({ description: "Filter by active status", required: false })
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiProperty({
    description: "Filter by email verification status",
    required: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  emailVerified?: boolean;

  @ApiProperty({ description: "Filter by created after date", required: false })
  @IsOptional()
  @IsString()
  createdAfter?: string;

  @ApiProperty({
    description: "Filter by created before date",
    required: false,
  })
  @IsOptional()
  @IsString()
  createdBefore?: string;

  @ApiProperty({
    description: "Filter by last login after date",
    required: false,
  })
  @IsOptional()
  @IsString()
  lastLoginAfter?: string;

  @ApiProperty({
    description: "Filter by last login before date",
    required: false,
  })
  @IsOptional()
  @IsString()
  lastLoginBefore?: string;
}

@ApiTags("Admin - Users")
@ApiBearerAuth()
@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserManagementController {
  constructor(
    private readonly userManagementService: UserManagementService,
    private readonly profileService: ProfileService,
  ) {}

  @Get()
  @Roles("admin", "super_admin")
  @ApiOperation({ summary: "Get list of users with filtering and pagination" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "role", required: false, type: String })
  @ApiQuery({ name: "isActive", required: false, type: Boolean })
  @ApiResponse({ status: 200, description: "Users retrieved successfully" })
  getUserList(@Query() _query: UserListQueryDto) {
    const filters: UserSearchFilters = {
      search: _query.search,
      role: _query.role,
      isActive: _query.isActive,
      emailVerified: _query.emailVerified,
      createdAfter: _query.createdAfter
        ? new Date(_query.createdAfter)
        : undefined,
      createdBefore: _query.createdBefore
        ? new Date(_query.createdBefore)
        : undefined,
      lastLoginAfter: _query.lastLoginAfter
        ? new Date(_query.lastLoginAfter)
        : undefined,
      lastLoginBefore: _query.lastLoginBefore
        ? new Date(_query.lastLoginBefore)
        : undefined,
    };

    const options: UserListOptions = {
      page: Number(_query.page) || 1,
      limit: Math.min(Number(_query.limit) || 20, 100), // Max 100 per page
      sortBy: _query.sortBy,
      sortOrder: _query.sortOrder,
      filters,
    };

    return this.userManagementService.getUserList(options);
  }

  @Get("stats")
  @Roles("admin", "super_admin")
  @ApiOperation({ summary: "Get user statistics" })
  @ApiResponse({
    status: 200,
    description: "User statistics retrieved successfully",
  })
  getUserStats() {
    return this.userManagementService.getUserStats();
  }

  @Get(":id")
  @Roles("admin", "super_admin")
  @ApiOperation({ summary: "Get user details by ID" })
  @ApiResponse({
    status: 200,
    description: "User details retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "User not found" })
  async getUserById(@Param("id", ParseUUIDPipe) id: string) {
    const user = await this.userManagementService.getUserById(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  @Put(":id")
  @Roles("admin", "super_admin")
  @ApiOperation({ summary: "Update user information" })
  @ApiResponse({ status: 200, description: "User updated successfully" })
  @ApiResponse({ status: 404, description: "User not found" })
  async updateUser(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateData: UpdateUserDto,
    @Request() req: Express.Request & { user: { id: string } },
  ) {
    const updatedUser = await this.userManagementService.updateUser(
      id,
      updateData,
    );

    // Log the activity
    await this.userManagementService.logActivity({
      userId: req.user.id,
      action: "user_update",
      resourceType: "user",
      resourceId: id,
      metadata: {
        updatedFields: Object.keys(updateData),
        targetUserId: id,
      },
    });

    return updatedUser;
  }

  @Put(":id/role")
  @Roles("admin", "super_admin")
  @ApiOperation({ summary: "Update user role" })
  @ApiResponse({ status: 200, description: "User role updated successfully" })
  @ApiResponse({ status: 404, description: "User not found" })
  updateUserRole(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() roleData: UpdateUserRoleDto,
    @Request() req: Express.Request & { user: { id: string } },
  ) {
    return this.userManagementService.updateUserRole(
      id,
      roleData.role,
      req.user.id,
    );
  }

  @Post(":id/activate")
  @Roles("admin", "super_admin")
  @ApiOperation({ summary: "Activate user account" })
  @ApiResponse({ status: 200, description: "User activated successfully" })
  @ApiResponse({ status: 404, description: "User not found" })
  activateUser(
    @Param("id", ParseUUIDPipe) id: string,
    @Request() req: Express.Request & { user: { id: string } },
  ) {
    return this.userManagementService.activateUser(id, req.user.id);
  }

  @Post(":id/deactivate")
  @Roles("admin", "super_admin")
  @ApiOperation({ summary: "Deactivate user account" })
  @ApiResponse({ status: 200, description: "User deactivated successfully" })
  @ApiResponse({ status: 404, description: "User not found" })
  deactivateUser(
    @Param("id", ParseUUIDPipe) id: string,
    @Request() req: Express.Request & { user: { id: string } },
  ) {
    return this.userManagementService.deactivateUser(id, req.user.id);
  }

  @Get(":id/activity")
  @Roles("admin", "super_admin")
  @ApiOperation({ summary: "Get user activity log" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "User activity retrieved successfully",
  })
  async getUserActivity(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    const pageNum = Number(page) || 1;
    const limitNum = Math.min(Number(limit) || 20, 200); // Max 200 per request
    const offset = (pageNum - 1) * limitNum;

    // Get activities
    const activities = await this.userManagementService.getUserActivity(id, {
      limit: limitNum,
      offset: offset,
    });

    // Get total count for pagination
    const totalActivities =
      await this.userManagementService.getUserActivityCount(id);
    const totalPages = Math.ceil(totalActivities / limitNum);

    return {
      activities,
      total: totalActivities,
      page: pageNum,
      limit: limitNum,
      totalPages,
    };
  }

  @Post("bulk")
  @Roles("admin", "super_admin")
  @ApiOperation({ summary: "Perform bulk operations on users" })
  @ApiResponse({
    status: 200,
    description: "Bulk operation completed successfully",
  })
  async bulkUserAction(
    @Body() bulkAction: BulkUserActionDto,
    @Request() req: Express.Request & { user: { id: string } },
  ) {
    const { userIds, action, role } = bulkAction;

    if (!userIds || userIds.length === 0) {
      throw new BadRequestException("User IDs are required");
    }

    if (userIds.length > 100) {
      throw new BadRequestException(
        "Maximum 100 users can be processed at once",
      );
    }

    const results = [];
    const errors = [];

    for (const userId of userIds) {
      try {
        let result;
        switch (action) {
          case "activate":
            result = await this.userManagementService.activateUser(
              userId,
              req.user.id,
            );
            break;
          case "deactivate":
            result = await this.userManagementService.deactivateUser(
              userId,
              req.user.id,
            );
            break;
          case "delete":
            // Soft delete by deactivating
            result = await this.userManagementService.deactivateUser(
              userId,
              req.user.id,
            );
            break;
          default:
            throw new BadRequestException(`Invalid action: ${action}`);
        }

        // If role is provided and action is not delete, update role
        if (role && action !== "delete") {
          result = await this.userManagementService.updateUserRole(
            userId,
            role,
            req.user.id,
          );
        }

        results.push({ userId, success: true, data: result });
      } catch (error) {
        errors.push({ userId, success: false, error: error instanceof Error ? error.message : String(error) });
      }
    }

    // Log bulk operation
    await this.userManagementService.logActivity({
      userId: req.user.id,
      action: `bulk_${action}`,
      resourceType: "user",
      metadata: {
        userIds,
        action,
        role,
        successCount: results.length,
        errorCount: errors.length,
      },
    });

    return {
      success: true,
      processed: userIds.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors,
    };
  }

  @Get(":id/files")
  @ApiOperation({ summary: "Get files for a specific user" })
  @ApiResponse({
    status: 200,
    description: "User files retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "User not found" })
  async getUserFiles(@Param("id", ParseUUIDPipe) id: string) {
    const files = await this.userManagementService.getUserFiles(id);
    return files;
  }

  // File serving endpoint
  @Get("files/:fileId")
  @ApiOperation({ summary: "Get user file by ID" })
  @ApiResponse({ status: 200, description: "File retrieved successfully" })
  @ApiResponse({ status: 404, description: "File not found" })
  async getFile(
    @Param("fileId", ParseUUIDPipe) fileId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.profileService.getFileById(fileId);
    if (!file) {
      throw new NotFoundException("File not found");
    }

    const buffer = await this.profileService.getFileBuffer(file);

    res.set({
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${file.originalName}"`,
      "Content-Length": file.fileSize.toString(),
    });

    return new StreamableFile(buffer);
  }
}
