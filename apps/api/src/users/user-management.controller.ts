import {
  Controller,
  Get,
  Put,
  Delete,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  NotFoundException,
  BadRequestException,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserManagementService, UserSearchFilters, UserListOptions } from './user-management.service';
import { ProfileService, ProfileUpdateData, PreferencesUpdateData } from './profile.service';
import { User } from '../database/schema';

// DTOs for API documentation and validation
export class UpdateUserDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  isActive?: boolean;
  emailVerified?: boolean;
}

export class UpdateUserRoleDto {
  role: 'user' | 'admin' | 'super_admin';
}

export class BulkUserActionDto {
  userIds: string[];
  action: 'activate' | 'deactivate' | 'delete';
  role?: 'user' | 'admin' | 'super_admin';
}

export class UserListQueryDto {
  page?: number = 1;
  limit?: number = 20;
  sortBy?: 'email' | 'firstName' | 'lastName' | 'createdAt' | 'lastLoginAt' = 'createdAt';
  sortOrder?: 'asc' | 'desc' = 'desc';
  search?: string;
  role?: string;
  isActive?: boolean;
  emailVerified?: boolean;
  createdAfter?: string;
  createdBefore?: string;
  lastLoginAfter?: string;
  lastLoginBefore?: string;
}

@ApiTags('Admin - Users')
@ApiBearerAuth()
@Controller('api/v1/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserManagementController {
  constructor(
    private readonly userManagementService: UserManagementService,
    private readonly profileService: ProfileService,
  ) {}

  @Get()
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get list of users with filtering and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'role', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async getUserList(@Query() query: UserListQueryDto) {
    const filters: UserSearchFilters = {
      search: query.search,
      role: query.role,
      isActive: query.isActive,
      emailVerified: query.emailVerified,
      createdAfter: query.createdAfter ? new Date(query.createdAfter) : undefined,
      createdBefore: query.createdBefore ? new Date(query.createdBefore) : undefined,
      lastLoginAfter: query.lastLoginAfter ? new Date(query.lastLoginAfter) : undefined,
      lastLoginBefore: query.lastLoginBefore ? new Date(query.lastLoginBefore) : undefined,
    };

    const options: UserListOptions = {
      page: Number(query.page) || 1,
      limit: Math.min(Number(query.limit) || 20, 100), // Max 100 per page
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      filters,
    };

    return this.userManagementService.getUserList(options);
  }

  @Get('stats')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiResponse({ status: 200, description: 'User statistics retrieved successfully' })
  async getUserStats() {
    return this.userManagementService.getUserStats();
  }

  @Get(':id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get user details by ID' })
  @ApiResponse({ status: 200, description: 'User details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.userManagementService.getUserById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  @Put(':id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Update user information' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateData: UpdateUserDto,
    @Request() req: any,
  ) {
    const updatedUser = await this.userManagementService.updateUser(id, updateData);
    
    // Log the activity
    await this.userManagementService.logActivity({
      userId: req.user.id,
      action: 'user_update',
      resourceType: 'user',
      resourceId: id,
      metadata: {
        updatedFields: Object.keys(updateData),
        targetUserId: id,
      },
    });

    return updatedUser;
  }

  @Put(':id/role')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Update user role' })
  @ApiResponse({ status: 200, description: 'User role updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() roleData: UpdateUserRoleDto,
    @Request() req: any,
  ) {
    return this.userManagementService.updateUserRole(id, roleData.role, req.user.id);
  }

  @Post(':id/activate')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Activate user account' })
  @ApiResponse({ status: 200, description: 'User activated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async activateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    return this.userManagementService.activateUser(id, req.user.id);
  }

  @Post(':id/deactivate')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Deactivate user account' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deactivateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    return this.userManagementService.deactivateUser(id, req.user.id);
  }

  @Get(':id/activity')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get user activity log' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'User activity retrieved successfully' })
  async getUserActivity(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.userManagementService.getUserActivity(id, {
      limit: Math.min(Number(limit) || 50, 200), // Max 200 per request
      offset: Number(offset) || 0,
    });
  }

  @Post('bulk')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Perform bulk operations on users' })
  @ApiResponse({ status: 200, description: 'Bulk operation completed successfully' })
  async bulkUserAction(
    @Body() bulkAction: BulkUserActionDto,
    @Request() req: any,
  ) {
    const { userIds, action, role } = bulkAction;

    if (!userIds || userIds.length === 0) {
      throw new BadRequestException('User IDs are required');
    }

    if (userIds.length > 100) {
      throw new BadRequestException('Maximum 100 users can be processed at once');
    }

    const results = [];
    const errors = [];

    for (const userId of userIds) {
      try {
        let result;
        switch (action) {
          case 'activate':
            result = await this.userManagementService.activateUser(userId, req.user.id);
            break;
          case 'deactivate':
            result = await this.userManagementService.deactivateUser(userId, req.user.id);
            break;
          case 'delete':
            // Soft delete by deactivating
            result = await this.userManagementService.deactivateUser(userId, req.user.id);
            break;
          default:
            throw new BadRequestException(`Invalid action: ${action}`);
        }

        // If role is provided and action is not delete, update role
        if (role && action !== 'delete') {
          result = await this.userManagementService.updateUserRole(userId, role, req.user.id);
        }

        results.push({ userId, success: true, data: result });
      } catch (error) {
        errors.push({ userId, success: false, error: error.message });
      }
    }

    // Log bulk operation
    await this.userManagementService.logActivity({
      userId: req.user.id,
      action: `bulk_${action}`,
      resourceType: 'user',
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

  // File serving endpoint
  @Get('files/:fileId')
  @ApiOperation({ summary: 'Get user file by ID' })
  @ApiResponse({ status: 200, description: 'File retrieved successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async getFile(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.profileService.getFileById(fileId);
    if (!file) {
      throw new NotFoundException('File not found');
    }

    const buffer = await this.profileService.getFileBuffer(file);

    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `inline; filename="${file.originalName}"`,
      'Content-Length': file.fileSize.toString(),
    });

    return new StreamableFile(buffer);
  }
}
