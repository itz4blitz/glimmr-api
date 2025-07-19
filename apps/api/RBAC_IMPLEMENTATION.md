# RBAC Implementation Guide

## Overview

This document outlines the implementation of a proper Role-Based Access Control (RBAC) system for the Glimmr API, addressing the security vulnerability where users could select their own roles during registration.

## Security Issue Fixed

**Previous Issue**: Users could choose their role (`admin` or `api-user`) during registration, which is a major security vulnerability.

**Solution**: Implemented a comprehensive RBAC system where:
- Users register with no role selection
- Default role is `api-user` 
- Only admins can assign/modify user roles
- Granular permissions control access to specific resources and actions

## Architecture

### Database Schema

The RBAC system introduces four new tables while maintaining backward compatibility:

1. **`roles`** - Defines available roles in the system
2. **`permissions`** - Defines granular permissions for resources and actions  
3. **`user_roles`** - Many-to-many relationship between users and roles
4. **`role_permissions`** - Many-to-many relationship between roles and permissions

### Key Features

- **Backward Compatibility**: Existing `role` field in users table is preserved
- **Granular Permissions**: Resource-action based permission system
- **Flexible Role Assignment**: Users can have multiple roles
- **Audit Trail**: Tracks who assigned roles and when
- **Role Expiration**: Optional expiration dates for role assignments
- **Soft Deletes**: Roles and permissions can be deactivated without deletion

## Default Roles

| Role | Description | Use Case |
|------|-------------|----------|
| `super-admin` | Full system access including user management | System administrators |
| `admin` | Full data and job management access | Application administrators |
| `api-user` | Read access to data endpoints | Standard API consumers |
| `viewer` | Read-only access to basic endpoints | Limited access users |

## Permission Structure

Permissions follow the format: `resource:action`

### Resources
- `api` - Core API information
- `auth` - Authentication operations
- `admin` - User/role management
- `hospitals` - Hospital data
- `prices` - Pricing data
- `analytics` - Analytics and reporting
- `jobs` - Background job management
- `odata` - OData protocol endpoints
- `health` - Health monitoring

### Actions
- `read` - View/retrieve data
- `write` - Create/update data
- `delete` - Remove data
- `execute` - Perform operations (jobs, exports, etc.)
- `admin` - Full administrative access

## Implementation Steps

### 1. Database Migration

```bash
# Run the migration to add RBAC tables
pnpm db:migrate

# Run the RBAC setup script
npm run db:seed:rbac
```

### 2. Updated Registration Process

**Before:**
```json
{
  "username": "user",
  "password": "password",
  "role": "admin"  // ❌ Security vulnerability
}
```

**After:**
```json
{
  "username": "user", 
  "password": "password",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe"
  // ✅ No role selection - defaults to 'api-user'
}
```

### 3. Admin User Management

New admin endpoints for user management:

```bash
# Get all users
GET /api/v1/admin/users

# Get user with roles
GET /api/v1/admin/users/{id}

# Assign role to user
POST /api/v1/admin/users/assign-role
{
  "userId": "uuid",
  "roleId": "uuid"
}

# Remove role from user  
DELETE /api/v1/admin/users/{userId}/roles/{roleId}

# Create new role
POST /api/v1/admin/roles
{
  "name": "content-manager",
  "description": "Manages content and data"
}

# Assign permission to role
POST /api/v1/admin/roles/assign-permission
{
  "roleId": "uuid", 
  "permissionId": "uuid"
}
```

## Migration Strategy

### Phase 1: Backward Compatibility (Current)
- RBAC tables added alongside existing role field
- Both systems work in parallel
- Existing authentication continues to work
- New admin endpoints available for role management

### Phase 2: Gradual Migration (Future)
- Migrate existing users to RBAC roles
- Update guards to use permission-based checks
- Deprecate legacy role field usage

### Phase 3: Full RBAC (Future)
- Remove legacy role field
- All access control through RBAC system
- Enhanced permission granularity

## Usage Examples

### Checking Permissions in Guards

```typescript
// Check if user has specific permission
const hasPermission = await this.rbacService.userHasPermission(
  userId, 
  'hospitals', 
  'write'
);

// Check if user has specific role
const hasRole = await this.rbacService.userHasRole(userId, 'admin');
```

### Creating Custom Roles

```typescript
// Create a new role for content managers
const role = await this.rbacService.createRole({
  name: 'content-manager',
  description: 'Manages hospital and pricing content'
});

// Assign specific permissions
await this.rbacService.assignPermissionToRole(
  role.id,
  hospitalReadPermissionId
);
await this.rbacService.assignPermissionToRole(
  role.id, 
  hospitalWritePermissionId
);
```

## Security Benefits

1. **Principle of Least Privilege**: Users get minimal access by default
2. **Granular Control**: Fine-grained permissions for specific operations
3. **Audit Trail**: Track who assigned what permissions when
4. **Role Separation**: Clear separation between user registration and role assignment
5. **Flexible Management**: Admins can create custom roles and permissions
6. **Secure Defaults**: New users have limited access until explicitly granted more

## Testing

The implementation includes comprehensive tests for:
- RBAC service functionality
- Permission checking
- Role assignment/removal
- Admin endpoints
- Backward compatibility

## Next Steps

1. **Deploy Migration**: Run database migration and RBAC setup
2. **Admin Training**: Train administrators on new user management endpoints
3. **Monitor Usage**: Monitor role assignments and permission usage
4. **Gradual Migration**: Plan migration of existing guards to use RBAC
5. **Documentation**: Update API documentation with new admin endpoints

## Rollback Plan

If issues arise, the system can be rolled back by:
1. Reverting to legacy role-based authentication
2. Disabling RBAC endpoints
3. The original role field remains intact for backward compatibility

This ensures zero downtime and maintains system stability during the transition.
