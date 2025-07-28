import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  roles,
  permissions,
  rolePermissions,
  users,
  userRoles,
} from "../schema";
import { eq } from "drizzle-orm";

// RBAC Setup Script
// This script sets up the initial roles, permissions, and role-permission mappings
// Run this after the migration to ensure proper RBAC configuration

async function setupRBAC() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  console.log("🔧 Setting up RBAC system...");

  try {
    // Check if roles already exist
    const existingRoles = await db.select().from(roles);
    if (existingRoles.length > 0) {
      console.log("✅ Roles already exist, skipping role creation");
    } else {
      // Create default roles
      console.log("📝 Creating default roles...");
      const defaultRoles = [
        {
          name: "super-admin",
          description:
            "Super administrator with all system permissions including user management",
        },
        {
          name: "admin",
          description:
            "Administrator with full access to data and job management",
        },
        {
          name: "api-user",
          description: "Standard API user with read access to data endpoints",
        },
        {
          name: "viewer",
          description: "Read-only access to basic data endpoints",
        },
      ];

      for (const role of defaultRoles) {
        await db.insert(roles).values(role);
        console.log(`  ✓ Created role: ${role.name}`);
      }
    }

    // Check if permissions already exist
    const existingPermissions = await db.select().from(permissions);
    if (existingPermissions.length > 0) {
      console.log("✅ Permissions already exist, skipping permission creation");
    } else {
      // Create comprehensive permissions
      console.log("📝 Creating permissions...");
      const defaultPermissions = [
        // Core API
        {
          name: "api:read",
          resource: "api",
          action: "read",
          description: "Read API information",
        },

        // Authentication
        {
          name: "auth:login",
          resource: "auth",
          action: "execute",
          description: "Login to the system",
        },
        {
          name: "auth:register",
          resource: "auth",
          action: "execute",
          description: "Register new account",
        },
        {
          name: "auth:profile",
          resource: "auth",
          action: "read",
          description: "View own profile",
        },
        {
          name: "auth:api-key",
          resource: "auth",
          action: "execute",
          description: "Generate API keys",
        },

        // User Management (Admin only)
        {
          name: "admin:users:read",
          resource: "admin",
          action: "read",
          description: "View all users",
        },
        {
          name: "admin:users:write",
          resource: "admin",
          action: "write",
          description: "Create and update users",
        },
        {
          name: "admin:users:delete",
          resource: "admin",
          action: "delete",
          description: "Deactivate users",
        },
        {
          name: "admin:roles:read",
          resource: "admin",
          action: "read",
          description: "View all roles",
        },
        {
          name: "admin:roles:write",
          resource: "admin",
          action: "write",
          description: "Create and update roles",
        },
        {
          name: "admin:permissions:read",
          resource: "admin",
          action: "read",
          description: "View all permissions",
        },
        {
          name: "admin:permissions:write",
          resource: "admin",
          action: "write",
          description: "Create and update permissions",
        },
        {
          name: "admin:assign-roles",
          resource: "admin",
          action: "execute",
          description: "Assign roles to users",
        },

        // Hospital Management
        {
          name: "hospitals:read",
          resource: "hospitals",
          action: "read",
          description: "Read hospital data",
        },
        {
          name: "hospitals:write",
          resource: "hospitals",
          action: "write",
          description: "Create and update hospital data",
        },
        {
          name: "hospitals:delete",
          resource: "hospitals",
          action: "delete",
          description: "Delete hospital data",
        },

        // Price Management
        {
          name: "prices:read",
          resource: "prices",
          action: "read",
          description: "Read pricing data",
        },
        {
          name: "prices:write",
          resource: "prices",
          action: "write",
          description: "Create and update pricing data",
        },
        {
          name: "prices:delete",
          resource: "prices",
          action: "delete",
          description: "Delete pricing data",
        },
        {
          name: "prices:analytics",
          resource: "prices",
          action: "read",
          description: "Access pricing analytics",
        },

        // Analytics
        {
          name: "analytics:dashboard",
          resource: "analytics",
          action: "read",
          description: "View analytics dashboard",
        },
        {
          name: "analytics:trends",
          resource: "analytics",
          action: "read",
          description: "View pricing trends",
        },
        {
          name: "analytics:export",
          resource: "analytics",
          action: "execute",
          description: "Export analytics data",
        },
        {
          name: "analytics:insights",
          resource: "analytics",
          action: "read",
          description: "View advanced analytics insights",
        },
        {
          name: "analytics:powerbi",
          resource: "analytics",
          action: "read",
          description: "Access PowerBI integration",
        },

        // Job Management
        {
          name: "jobs:read",
          resource: "jobs",
          action: "read",
          description: "View job status and information",
        },
        {
          name: "jobs:execute",
          resource: "jobs",
          action: "execute",
          description: "Trigger background jobs",
        },
        {
          name: "jobs:admin",
          resource: "jobs",
          action: "admin",
          description: "Full job management including Bull Board",
        },
        {
          name: "jobs:cleanup",
          resource: "jobs",
          action: "execute",
          description: "Cleanup and manage job queues",
        },

        // OData
        {
          name: "odata:read",
          resource: "odata",
          action: "read",
          description: "Access OData endpoints",
        },
        {
          name: "odata:batch",
          resource: "odata",
          action: "execute",
          description: "Execute OData batch operations",
        },

        // Health Monitoring
        {
          name: "health:read",
          resource: "health",
          action: "read",
          description: "Access health check endpoints",
        },
      ];

      for (const permission of defaultPermissions) {
        await db.insert(permissions).values(permission);
        console.log(`  ✓ Created permission: ${permission.name}`);
      }
    }

    // Set up role-permission mappings
    console.log("🔗 Setting up role-permission mappings...");

    // Get all roles and permissions
    const allRoles = await db.select().from(roles);
    const allPermissions = await db.select().from(permissions);

    const roleMap = new Map(allRoles.map((r) => [r.name, r.id]));
    const permissionMap = new Map(allPermissions.map((p) => [p.name, p.id]));

    // Define role-permission mappings
    const roleMappings = {
      "super-admin": allPermissions.map((p) => p.name), // All permissions
      admin: [
        "api:read",
        "auth:login",
        "auth:profile",
        "auth:api-key",
        "hospitals:read",
        "hospitals:write",
        "hospitals:delete",
        "prices:read",
        "prices:write",
        "prices:delete",
        "prices:analytics",
        "analytics:dashboard",
        "analytics:trends",
        "analytics:export",
        "analytics:insights",
        "analytics:powerbi",
        "jobs:read",
        "jobs:execute",
        "jobs:admin",
        "jobs:cleanup",
        "odata:read",
        "odata:batch",
        "health:read",
      ],
      "api-user": [
        "api:read",
        "auth:login",
        "auth:profile",
        "auth:api-key",
        "hospitals:read",
        "prices:read",
        "prices:analytics",
        "analytics:dashboard",
        "analytics:trends",
        "jobs:read",
        "odata:read",
        "health:read",
      ],
      viewer: [
        "api:read",
        "auth:login",
        "auth:profile",
        "hospitals:read",
        "prices:read",
        "analytics:dashboard",
        "health:read",
      ],
    };

    // Clear existing role-permission mappings
    await db.delete(rolePermissions);

    // Create new mappings
    for (const [roleName, permissionNames] of Object.entries(roleMappings)) {
      const roleId = roleMap.get(roleName);
      if (!roleId) {
        console.log(`⚠️  Role ${roleName} not found, skipping...`);
        continue;
      }

      for (const permissionName of permissionNames) {
        const permissionId = permissionMap.get(permissionName);
        if (!permissionId) {
          console.log(
            `⚠️  Permission ${permissionName} not found, skipping...`,
          );
          continue;
        }

        await db.insert(rolePermissions).values({
          roleId,
          permissionId,
        });
      }
      console.log(
        `  ✓ Configured permissions for role: ${roleName} (${permissionNames.length} permissions)`,
      );
    }

    // Migrate existing users to RBAC system if not already done
    console.log("👥 Migrating existing users to RBAC system...");
    const existingUsers = await db.select().from(users);

    for (const user of existingUsers) {
      // Check if user already has RBAC roles assigned
      const existingUserRoles = await db
        .select()
        .from(userRoles)
        .where(eq(userRoles.userId, user.id));

      if (existingUserRoles.length === 0) {
        // Assign role based on legacy role field
        const roleId = roleMap.get(user.role);
        if (roleId) {
          await db.insert(userRoles).values({
            userId: user.id,
            roleId,
          });
          console.log(`  ✓ Assigned ${user.role} role to user: ${user.email}`);
        }
      }
    }

    console.log("✅ RBAC setup completed successfully!");
    console.log("\n📋 Summary:");
    console.log(`   Roles: ${allRoles.length}`);
    console.log(`   Permissions: ${allPermissions.length}`);
    console.log(`   Users migrated: ${existingUsers.length}`);
  } catch (_error) {
    console.error("Error", _error);
    throw _error;
  } finally {
    await pool.end();
  }
}

// Run the setup if this file is executed directly
if (require.main === module) {
  setupRBAC()
    .then(() => {
      console.log("🎉 RBAC setup completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 RBAC setup failed:", error);
      process.exit(1);
    });
}

export { setupRBAC };
