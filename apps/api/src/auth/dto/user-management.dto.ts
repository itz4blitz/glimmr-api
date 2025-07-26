import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsArray,
  IsBoolean,
  IsDate,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateRoleDto {
  @ApiProperty({ description: "Role name", example: "content-manager" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: "Role description", required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreatePermissionDto {
  @ApiProperty({ description: "Permission name", example: "hospitals:read" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: "Resource name", example: "hospitals" })
  @IsString()
  @IsNotEmpty()
  resource: string;

  @ApiProperty({
    description: "Action name",
    enum: ["read", "write", "delete", "execute", "admin"],
  })
  @IsString()
  @IsNotEmpty()
  action: "read" | "write" | "delete" | "execute" | "admin";

  @ApiProperty({ description: "Permission description", required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

export class AssignRoleDto {
  @ApiProperty({ description: "User ID" })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: "Role ID" })
  @IsUUID()
  roleId: string;

  @ApiProperty({ description: "Role expiration date", required: false })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;
}

export class AssignPermissionToRoleDto {
  @ApiProperty({ description: "Role ID" })
  @IsUUID()
  roleId: string;

  @ApiProperty({ description: "Permission ID" })
  @IsUUID()
  permissionId: string;
}

export class BulkAssignRolesDto {
  @ApiProperty({ description: "User ID" })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: "Array of role IDs", type: [String] })
  @IsArray()
  @IsUUID(4, { each: true })
  roleIds: string[];
}

export class UpdateUserDto {
  @ApiProperty({ description: "Email address", required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ description: "First name", required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ description: "Last name", required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ description: "User active status", required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
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
}
