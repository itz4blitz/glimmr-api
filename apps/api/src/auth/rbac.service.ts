import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import {
  roles,
  permissions,
  userRoles,
  rolePermissions,
  users,
  type Role,
  type Permission,
  type UserRole,
  type RolePermission,
  type NewRole,
  type NewPermission,
  type UserWithRoles,
  type RoleWithPermissions,
} from "../database/schema";
import { eq, and, sql } from "drizzle-orm";
import { PinoLogger, InjectPinoLogger } from "nestjs-pino";

@Injectable()
export class RbacService {
  constructor(
    private readonly databaseService: DatabaseService,
    @InjectPinoLogger(RbacService.name)
    private readonly logger: PinoLogger,
  ) {}

  private get db() {
    return this.databaseService.db;
  }

  // Role Management
  async createRole(roleData: NewRole): Promise<Role> {
    const [role] = await this.db
      .insert(roles)
      .values(roleData as NewRole)
      .returning();

    this.logger.info({
      msg: "Role created",
      roleId: role.id,
      roleName: role.name,
    });
    return role;
  }

  getRoles(): Promise<Role[]> {
    return this.db
      .select()
      .from(roles)
      .where(eq(roles.isActive, true))
      .orderBy(roles.name);
  }

  async getRoleById(id: string): Promise<Role | null> {
    const [role] = await this.db
      .select()
      .from(roles)
      .where(and(eq(roles.id, id), eq(roles.isActive, true)));

    return role || null;
  }

  async getRoleWithPermissions(
    roleId: string,
  ): Promise<RoleWithPermissions | null> {
    const roleData = await this.db
      .select({
        id: roles.id,
        name: roles.name,
        description: roles.description,
        permissionId: permissions.id,
        permissionName: permissions.name,
        resource: permissions.resource,
        action: permissions.action,
        permissionDescription: permissions.description,
      })
      .from(roles)
      .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(roles.id, roleId),
          eq(roles.isActive, true),
          eq(rolePermissions.isActive, true),
          eq(permissions.isActive, true),
        ),
      );

    if (roleData.length === 0) return null;

    const role = roleData[0];
    const permissionsSet = new Map();

    roleData.forEach((row) => {
      if (row.permissionId) {
        permissionsSet.set(row.permissionId, {
          id: row.permissionId,
          name: row.permissionName,
          resource: row.resource,
          action: row.action,
          description: row.permissionDescription,
        });
      }
    });

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: Array.from(permissionsSet.values()),
    };
  }

  // Permission Management
  async createPermission(permissionData: NewPermission): Promise<Permission> {
    const [permission] = await this.db
      .insert(permissions)
      .values(permissionData as NewPermission)
      .returning();

    this.logger.info({
      msg: "Permission created",
      permissionId: permission.id,
      permissionName: permission.name,
    });
    return permission;
  }

  getPermissions(): Promise<Permission[]> {
    return this.db
      .select()
      .from(permissions)
      .where(eq(permissions.isActive, true))
      .orderBy(permissions.resource, permissions.action);
  }

  getPermissionsByResource(resource: string): Promise<Permission[]> {
    return this.db
      .select()
      .from(permissions)
      .where(
        and(eq(permissions.resource, resource), eq(permissions.isActive, true)),
      )
      .orderBy(permissions.action);
  }

  // User Role Assignment
  async assignRoleToUser(
    userId: string,
    roleId: string,
    assignedBy?: string,
  ): Promise<UserRole> {
    // Check if assignment already exists
    const existing = await this.db
      .select()
      .from(userRoles)
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.roleId, roleId),
          eq(userRoles.isActive, true),
        ),
      );

    if (existing.length > 0) {
      throw new Error("User already has this role assigned");
    }

    const [userRole] = await this.db
      .insert(userRoles)
      .values({
        userId,
        roleId,
        assignedBy,
      })
      .returning();

    this.logger.info({
      msg: "Role assigned to user",
      userId,
      roleId,
      assignedBy,
    });
    return userRole;
  }

  async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    await this.db
      .update(userRoles)
      .set({
        isActive: false,
      })
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));

    this.logger.info({
      msg: "Role removed from user",
      userId,
      roleId,
    });
  }

  async getUserRoles(userId: string): Promise<Role[]> {
    const userRoleData = await this.db
      .select({
        id: roles.id,
        name: roles.name,
        description: roles.description,
        isActive: roles.isActive,
        createdAt: roles.createdAt,
        updatedAt: roles.updatedAt,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.isActive, true),
          eq(roles.isActive, true),
        ),
      );

    return userRoleData;
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    const userPermissions = await this.db
      .select({
        id: permissions.id,
        name: permissions.name,
        resource: permissions.resource,
        action: permissions.action,
        description: permissions.description,
        isActive: permissions.isActive,
        createdAt: permissions.createdAt,
        updatedAt: permissions.updatedAt,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.isActive, true),
          eq(roles.isActive, true),
          eq(rolePermissions.isActive, true),
          eq(permissions.isActive, true),
        ),
      );

    // Remove duplicates
    const uniquePermissions = new Map();
    userPermissions.forEach((permission) => {
      uniquePermissions.set(permission.id, permission);
    });

    return Array.from(uniquePermissions.values());
  }

  async getUserWithRoles(userId: string): Promise<UserWithRoles | null> {
    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
      })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.isActive, true)));

    if (!user) return null;

    const userRolesList = await this.getUserRoles(userId);
    const userPermissionsList = await this.getUserPermissions(userId);

    return {
      id: user.id,
      email: user.email,
      roles: userRolesList,
      permissions: userPermissionsList,
    };
  }

  // Permission Checking
  async userHasPermission(
    userId: string,
    resource: string,
    action: string,
  ): Promise<boolean> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(permissions.resource, resource),
          eq(permissions.action, action),
          eq(userRoles.isActive, true),
          eq(roles.isActive, true),
          eq(rolePermissions.isActive, true),
          eq(permissions.isActive, true),
        ),
      );

    return result[0].count > 0;
  }

  async userHasRole(userId: string, roleName: string): Promise<boolean> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(roles.name, roleName),
          eq(userRoles.isActive, true),
          eq(roles.isActive, true),
        ),
      );

    return result[0].count > 0;
  }

  // Role Permission Assignment
  async assignPermissionToRole(
    roleId: string,
    permissionId: string,
    grantedBy?: string,
  ): Promise<RolePermission> {
    // Check if assignment already exists
    const existing = await this.db
      .select()
      .from(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, roleId),
          eq(rolePermissions.permissionId, permissionId),
          eq(rolePermissions.isActive, true),
        ),
      );

    if (existing.length > 0) {
      throw new Error("Role already has this permission assigned");
    }

    const [rolePermission] = await this.db
      .insert(rolePermissions)
      .values({
        roleId,
        permissionId,
        grantedBy,
      })
      .returning();

    this.logger.info({
      msg: "Permission assigned to role",
      roleId,
      permissionId,
      grantedBy,
    });
    return rolePermission;
  }

  async removePermissionFromRole(
    roleId: string,
    permissionId: string,
  ): Promise<void> {
    await this.db
      .update(rolePermissions)
      .set({
        isActive: false,
      })
      .where(
        and(
          eq(rolePermissions.roleId, roleId),
          eq(rolePermissions.permissionId, permissionId),
        ),
      );

    this.logger.info({
      msg: "Permission removed from role",
      roleId,
      permissionId,
    });
  }
}
