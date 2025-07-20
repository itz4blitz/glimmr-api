import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query,
  UseGuards,
  Request,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { RbacService } from './rbac.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import {
  CreateRoleDto,
  CreatePermissionDto,
  AssignRoleDto,
  AssignPermissionToRoleDto,
  BulkAssignRolesDto,
  UpdateUserDto,
  UserListQueryDto
} from './dto/user-management.dto';
import { SendEmailDto, SendTestEmailDto } from '../email/dto/email.dto';

@ApiTags('Admin - System')
@Controller('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(
    private readonly rbacService: RbacService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
  ) {}

  // User Management
  @Get('users')
  @ApiOperation({ summary: 'Get all users with pagination and filtering' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @Roles('admin')
  async getUsers(@Query() query: UserListQueryDto) {
    // This would need to be implemented in UsersService with proper pagination
    const users = await this.usersService.findAll();
    
    // Basic filtering (should be moved to service layer)
    let filteredUsers = users;
    if (query.search) {
      filteredUsers = users.filter(user => 
        user.email?.toLowerCase().includes(query.search!.toLowerCase()) ||
        (user.email && user.email.toLowerCase().includes(query.search!.toLowerCase()))
      );
    }

    return {
      users: filteredUsers,
      total: filteredUsers.length,
      page: query.page,
      limit: query.limit,
    };
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by ID with roles and permissions' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @Roles('admin')
  async getUserById(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const userWithRoles = await this.rbacService.getUserWithRoles(id);
    return userWithRoles;
  }

  @Put('users/:id')
  @ApiOperation({ summary: 'Update user information' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @Roles('admin')
  async updateUser(@Param('id') id: string, @Body() updateData: UpdateUserDto) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    // This would need to be implemented in UsersService
    throw new HttpException('Update user not implemented yet', HttpStatus.NOT_IMPLEMENTED);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Deactivate user account' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @Roles('admin')
  async deactivateUser(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    await this.usersService.deactivate(id);
    return { message: 'User deactivated successfully' };
  }

  // Role Management
  @Get('roles')
  @ApiOperation({ summary: 'Get all roles' })
  @ApiResponse({ status: 200, description: 'Roles retrieved successfully' })
  @Roles('admin')
  async getRoles() {
    return this.rbacService.getRoles();
  }

  @Post('roles')
  @ApiOperation({ summary: 'Create new role' })
  @ApiResponse({ status: 201, description: 'Role created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid role data' })
  @Roles('admin')
  async createRole(@Body() createRoleDto: CreateRoleDto, @Request() req) {
    try {
      const role = await this.rbacService.createRole(createRoleDto);
      return role;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('roles/:id')
  @ApiOperation({ summary: 'Get role with permissions' })
  @ApiResponse({ status: 200, description: 'Role retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @Roles('admin')
  async getRoleById(@Param('id') id: string) {
    const role = await this.rbacService.getRoleWithPermissions(id);
    if (!role) {
      throw new HttpException('Role not found', HttpStatus.NOT_FOUND);
    }
    return role;
  }

  // Permission Management
  @Get('permissions')
  @ApiOperation({ summary: 'Get all permissions' })
  @ApiResponse({ status: 200, description: 'Permissions retrieved successfully' })
  @Roles('admin')
  async getPermissions() {
    return this.rbacService.getPermissions();
  }

  @Post('permissions')
  @ApiOperation({ summary: 'Create new permission' })
  @ApiResponse({ status: 201, description: 'Permission created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid permission data' })
  @Roles('admin')
  async createPermission(@Body() createPermissionDto: CreatePermissionDto) {
    try {
      const permission = await this.rbacService.createPermission(createPermissionDto);
      return permission;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  // Role Assignment
  @Post('users/assign-role')
  @ApiOperation({ summary: 'Assign role to user' })
  @ApiResponse({ status: 201, description: 'Role assigned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid assignment data' })
  @Roles('admin')
  async assignRole(@Body() assignRoleDto: AssignRoleDto, @Request() req) {
    try {
      const assignment = await this.rbacService.assignRoleToUser(
        assignRoleDto.userId,
        assignRoleDto.roleId,
        req.user.id
      );
      return assignment;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete('users/:userId/roles/:roleId')
  @ApiOperation({ summary: 'Remove role from user' })
  @ApiResponse({ status: 200, description: 'Role removed successfully' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @Roles('admin')
  async removeRole(@Param('userId') userId: string, @Param('roleId') roleId: string) {
    await this.rbacService.removeRoleFromUser(userId, roleId);
    return { message: 'Role removed successfully' };
  }

  @Post('roles/assign-permission')
  @ApiOperation({ summary: 'Assign permission to role' })
  @ApiResponse({ status: 201, description: 'Permission assigned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid assignment data' })
  @Roles('admin')
  async assignPermissionToRole(@Body() assignDto: AssignPermissionToRoleDto, @Request() req) {
    try {
      const assignment = await this.rbacService.assignPermissionToRole(
        assignDto.roleId,
        assignDto.permissionId,
        req.user.id
      );
      return assignment;
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete('roles/:roleId/permissions/:permissionId')
  @ApiOperation({ summary: 'Remove permission from role' })
  @ApiResponse({ status: 200, description: 'Permission removed successfully' })
  @ApiParam({ name: 'roleId', description: 'Role ID' })
  @ApiParam({ name: 'permissionId', description: 'Permission ID' })
  @Roles('admin')
  async removePermissionFromRole(@Param('roleId') roleId: string, @Param('permissionId') permissionId: string) {
    await this.rbacService.removePermissionFromRole(roleId, permissionId);
    return { message: 'Permission removed successfully' };
  }

  // Email Management
  @Get('email/test-connection')
  @ApiOperation({ summary: 'Test email service connection' })
  @ApiResponse({ status: 200, description: 'Email service connection test completed' })
  @Roles('admin')
  async testEmailConnection() {
    return await this.emailService.testConnection();
  }

  @Post('email/send-test')
  @ApiOperation({ summary: 'Send test email' })
  @ApiResponse({ status: 200, description: 'Test email sent successfully' })
  @ApiResponse({ status: 400, description: 'Failed to send test email' })
  @Roles('admin')
  async sendTestEmail(@Body() testEmailDto: SendTestEmailDto = {}) {
    return await this.emailService.sendTestEmail(testEmailDto.to);
  }

  @Post('email/send')
  @ApiOperation({ summary: 'Send custom email' })
  @ApiResponse({ status: 200, description: 'Email sent successfully' })
  @ApiResponse({ status: 400, description: 'Failed to send email' })
  @Roles('admin')
  async sendEmail(@Body() emailData: SendEmailDto) {
    return await this.emailService.sendEmail(emailData);
  }
}
