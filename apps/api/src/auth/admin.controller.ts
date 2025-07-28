import {
  Controller,
  Get,
  Post,
  // Put,
  Delete,
  Body,
  Param,
  // Query,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  // ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { Roles } from "./decorators/roles.decorator";
import { RbacService } from "./rbac.service";
import { UsersService } from "../users/users.service";
import {
  CreateRoleDto,
  CreatePermissionDto,
  AssignRoleDto,
  AssignPermissionToRoleDto,
} from "./dto/user-management.dto";

@ApiTags("Admin - Roles & Permissions")
@Controller("admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(
    private readonly rbacService: RbacService,
    private readonly usersService: UsersService,
  ) {}

  // Role Management
  @Get("roles")
  @ApiOperation({ summary: "Get all roles" })
  @ApiResponse({ status: 200, description: "Roles retrieved successfully" })
  @Roles("admin")
  getRoles() {
    return this.rbacService.getRoles();
  }

  @Post("roles")
  @ApiOperation({ summary: "Create new role" })
  @ApiResponse({ status: 201, description: "Role created successfully" })
  @ApiResponse({ status: 400, description: "Invalid role data" })
  @Roles("admin")
  async createRole(@Body() createRoleDto: CreateRoleDto, @Request() _req) {
    try {
      const role = await this.rbacService.createRole(createRoleDto);
      return role;
    } catch (error) {
      throw new HttpException((error as Error).message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get("roles/:id")
  @ApiOperation({ summary: "Get role with permissions" })
  @ApiResponse({ status: 200, description: "Role retrieved successfully" })
  @ApiResponse({ status: 404, description: "Role not found" })
  @ApiParam({ name: "id", description: "Role ID" })
  @Roles("admin")
  async getRoleById(@Param("id") id: string) {
    const role = await this.rbacService.getRoleWithPermissions(id);
    if (!role) {
      throw new HttpException("Role not found", HttpStatus.NOT_FOUND);
    }
    return role;
  }

  // Permission Management
  @Get("permissions")
  @ApiOperation({ summary: "Get all permissions" })
  @ApiResponse({
    status: 200,
    description: "Permissions retrieved successfully",
  })
  @Roles("admin")
  getPermissions() {
    return this.rbacService.getPermissions();
  }

  @Post("permissions")
  @ApiOperation({ summary: "Create new permission" })
  @ApiResponse({ status: 201, description: "Permission created successfully" })
  @ApiResponse({ status: 400, description: "Invalid permission data" })
  @Roles("admin")
  async createPermission(@Body() createPermissionDto: CreatePermissionDto) {
    try {
      const permission =
        await this.rbacService.createPermission(createPermissionDto);
      return permission;
    } catch (error) {
      throw new HttpException((error as Error).message, HttpStatus.BAD_REQUEST);
    }
  }

  // Role Assignment
  @Post("users/assign-role")
  @ApiOperation({ summary: "Assign role to user" })
  @ApiResponse({ status: 201, description: "Role assigned successfully" })
  @ApiResponse({ status: 400, description: "Invalid assignment data" })
  @Roles("admin")
  async assignRole(@Body() assignRoleDto: AssignRoleDto, @Request() _req) {
    try {
      const assignment = await this.rbacService.assignRoleToUser(
        assignRoleDto.userId,
        assignRoleDto.roleId,
        _req.user.id,
      );
      return assignment;
    } catch (error) {
      throw new HttpException((error as Error).message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete("users/:userId/roles/:roleId")
  @ApiOperation({ summary: "Remove role from user" })
  @ApiResponse({ status: 200, description: "Role removed successfully" })
  @ApiParam({ name: "userId", description: "User ID" })
  @ApiParam({ name: "roleId", description: "Role ID" })
  @Roles("admin")
  async removeRole(
    @Param("userId") userId: string,
    @Param("roleId") roleId: string,
  ) {
    await this.rbacService.removeRoleFromUser(userId, roleId);
    return { message: "Role removed successfully" };
  }

  @Post("roles/assign-permission")
  @ApiOperation({ summary: "Assign permission to role" })
  @ApiResponse({ status: 201, description: "Permission assigned successfully" })
  @ApiResponse({ status: 400, description: "Invalid assignment data" })
  @Roles("admin")
  async assignPermissionToRole(
    @Body() assignDto: AssignPermissionToRoleDto,
    @Request() _req,
  ) {
    try {
      const assignment = await this.rbacService.assignPermissionToRole(
        assignDto.roleId,
        assignDto.permissionId,
        _req.user.id,
      );
      return assignment;
    } catch (error) {
      throw new HttpException((error as Error).message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete("roles/:roleId/permissions/:permissionId")
  @ApiOperation({ summary: "Remove permission from role" })
  @ApiResponse({ status: 200, description: "Permission removed successfully" })
  @ApiParam({ name: "roleId", description: "Role ID" })
  @ApiParam({ name: "permissionId", description: "Permission ID" })
  @Roles("admin")
  async removePermissionFromRole(
    @Param("roleId") roleId: string,
    @Param("permissionId") permissionId: string,
  ) {
    await this.rbacService.removePermissionFromRole(roleId, permissionId);
    return { message: "Permission removed successfully" };
  }

}
