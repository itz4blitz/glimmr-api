-- Add RBAC tables while maintaining backward compatibility
-- This migration adds the new RBAC system alongside the existing role field

-- Add new fields to users table for enhanced user management
ALTER TABLE "users" ADD COLUMN "email" varchar(255);
ALTER TABLE "users" ADD COLUMN "first_name" varchar(50);
ALTER TABLE "users" ADD COLUMN "last_name" varchar(50);
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp;

-- Add unique constraint for email
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");

-- Add indexes for new fields
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");
CREATE INDEX "users_active_idx" ON "users" USING btree ("is_active");

-- Create roles table
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);

-- Create permissions table
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"resource" varchar(50) NOT NULL,
	"action" varchar(50) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);

-- Create user_roles junction table
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_by" uuid,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);

-- Create role_permissions junction table
CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"granted_by" uuid,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);

-- Add foreign key constraints
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

-- Create indexes for performance
CREATE INDEX "roles_name_idx" ON "roles" USING btree ("name");
CREATE INDEX "roles_active_idx" ON "roles" USING btree ("is_active");

CREATE INDEX "permissions_name_idx" ON "permissions" USING btree ("name");
CREATE INDEX "permissions_resource_idx" ON "permissions" USING btree ("resource");
CREATE INDEX "permissions_action_idx" ON "permissions" USING btree ("action");
CREATE INDEX "permissions_active_idx" ON "permissions" USING btree ("is_active");
CREATE INDEX "permissions_resource_action_idx" ON "permissions" USING btree ("resource","action");

CREATE INDEX "user_roles_user_role_idx" ON "user_roles" USING btree ("user_id","role_id");
CREATE INDEX "user_roles_user_idx" ON "user_roles" USING btree ("user_id");
CREATE INDEX "user_roles_role_idx" ON "user_roles" USING btree ("role_id");
CREATE INDEX "user_roles_active_idx" ON "user_roles" USING btree ("is_active");
CREATE INDEX "user_roles_expires_idx" ON "user_roles" USING btree ("expires_at");

CREATE INDEX "role_permissions_role_permission_idx" ON "role_permissions" USING btree ("role_id","permission_id");
CREATE INDEX "role_permissions_role_idx" ON "role_permissions" USING btree ("role_id");
CREATE INDEX "role_permissions_permission_idx" ON "role_permissions" USING btree ("permission_id");
CREATE INDEX "role_permissions_active_idx" ON "role_permissions" USING btree ("is_active");

-- Insert default roles (matching existing system)
INSERT INTO "roles" ("name", "description") VALUES 
('admin', 'Full system administrator with all permissions'),
('api-user', 'Standard API user with read access to data endpoints');

-- Insert default permissions
INSERT INTO "permissions" ("name", "resource", "action", "description") VALUES 
-- Core API permissions
('api:read', 'api', 'read', 'Read API information'),

-- Hospital permissions
('hospitals:read', 'hospitals', 'read', 'Read hospital data'),
('hospitals:write', 'hospitals', 'write', 'Create and update hospital data'),
('hospitals:delete', 'hospitals', 'delete', 'Delete hospital data'),

-- Price permissions
('prices:read', 'prices', 'read', 'Read pricing data'),
('prices:write', 'prices', 'write', 'Create and update pricing data'),
('prices:delete', 'prices', 'delete', 'Delete pricing data'),

-- Analytics permissions
('analytics:read', 'analytics', 'read', 'Read analytics and reports'),
('analytics:export', 'analytics', 'execute', 'Export analytics data'),

-- Job permissions
('jobs:read', 'jobs', 'read', 'View job status and information'),
('jobs:execute', 'jobs', 'execute', 'Trigger and manage background jobs'),
('jobs:admin', 'jobs', 'admin', 'Full job management including Bull Board access'),

-- OData permissions
('odata:read', 'odata', 'read', 'Access OData endpoints'),

-- Admin permissions
('admin:users', 'admin', 'admin', 'Manage users, roles, and permissions'),

-- Health permissions
('health:read', 'health', 'read', 'Access health check endpoints');

-- Assign permissions to roles
-- Admin role gets all permissions
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id 
FROM "roles" r, "permissions" p 
WHERE r.name = 'admin';

-- API user role gets read permissions only
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id 
FROM "roles" r, "permissions" p 
WHERE r.name = 'api-user' 
AND p.action IN ('read');

-- Migrate existing users to RBAC system
-- This creates user_role assignments based on existing role field
INSERT INTO "user_roles" ("user_id", "role_id")
SELECT u.id, r.id
FROM "users" u
JOIN "roles" r ON u.role = r.name
WHERE u.is_active = true;

-- Update all existing users to be active (new field default)
UPDATE "users" SET "is_active" = true WHERE "is_active" IS NULL;
