import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";

// Roles table
export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 50 }).notNull().unique(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index("roles_name_idx").on(table.name),
    activeIdx: index("roles_active_idx").on(table.isActive),
  }),
);

// Permissions table
export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    resource: varchar("resource", { length: 50 }).notNull(), // e.g., 'hospitals', 'jobs', 'analytics'
    action: varchar("action", { length: 50 }).notNull(), // e.g., 'read', 'write', 'delete', 'execute'
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index("permissions_name_idx").on(table.name),
    resourceIdx: index("permissions_resource_idx").on(table.resource),
    actionIdx: index("permissions_action_idx").on(table.action),
    activeIdx: index("permissions_active_idx").on(table.isActive),
    resourceActionIdx: index("permissions_resource_action_idx").on(
      table.resource,
      table.action,
    ),
  }),
);

// User-Role junction table (many-to-many)
export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    assignedBy: uuid("assigned_by").references(() => users.id), // Who assigned this role
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"), // Optional role expiration
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => ({
    userRoleIdx: index("user_roles_user_role_idx").on(
      table.userId,
      table.roleId,
    ),
    userIdx: index("user_roles_user_idx").on(table.userId),
    roleIdx: index("user_roles_role_idx").on(table.roleId),
    activeIdx: index("user_roles_active_idx").on(table.isActive),
    expiresIdx: index("user_roles_expires_idx").on(table.expiresAt),
    // Unique constraint to prevent duplicate role assignments
    userRolePk: primaryKey({ columns: [table.userId, table.roleId] }),
  }),
);

// Role-Permission junction table (many-to-many)
export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    grantedBy: uuid("granted_by").references(() => users.id), // Who granted this permission
    grantedAt: timestamp("granted_at").defaultNow().notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => ({
    rolePermissionIdx: index("role_permissions_role_permission_idx").on(
      table.roleId,
      table.permissionId,
    ),
    roleIdx: index("role_permissions_role_idx").on(table.roleId),
    permissionIdx: index("role_permissions_permission_idx").on(
      table.permissionId,
    ),
    activeIdx: index("role_permissions_active_idx").on(table.isActive),
    // Unique constraint to prevent duplicate permission assignments
    rolePermissionPk: primaryKey({
      columns: [table.roleId, table.permissionId],
    }),
  }),
);

// Zod schemas for validation
export const insertRoleSchema = createInsertSchema(roles, {
  name: z.string().min(2).max(50),
  description: z.string().max(500).optional(),
});

export const insertPermissionSchema = createInsertSchema(permissions, {
  name: z.string().min(2).max(100),
  resource: z.string().min(2).max(50),
  action: z.enum(["read", "write", "delete", "execute", "admin"]),
  description: z.string().max(500).optional(),
});

export const insertUserRoleSchema = createInsertSchema(userRoles, {
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
  assignedBy: z.string().uuid().optional(),
  expiresAt: z.date().optional(),
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions, {
  roleId: z.string().uuid(),
  permissionId: z.string().uuid(),
  grantedBy: z.string().uuid().optional(),
});

// Select schemas
export const selectRoleSchema = createSelectSchema(roles);
export const selectPermissionSchema = createSelectSchema(permissions);
export const selectUserRoleSchema = createSelectSchema(userRoles);
export const selectRolePermissionSchema = createSelectSchema(rolePermissions);

// Types
export type Role = z.infer<typeof selectRoleSchema>;
export type Permission = z.infer<typeof selectPermissionSchema>;
export type UserRole = z.infer<typeof selectUserRoleSchema>;
export type RolePermission = z.infer<typeof selectRolePermissionSchema>;

export type NewRole = z.infer<typeof insertRoleSchema>;
export type NewPermission = z.infer<typeof insertPermissionSchema>;
export type NewUserRole = z.infer<typeof insertUserRoleSchema>;
export type NewRolePermission = z.infer<typeof insertRolePermissionSchema>;

// Helper types for complex queries
export type UserWithRoles = {
  id: string;
  email: string;
  roles: Role[];
  permissions: Permission[];
};

export type RoleWithPermissions = {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
};
