import { UserRole } from '@/types/auth'

// Role hierarchy - higher numbers have more permissions
const ROLE_HIERARCHY = {
  [UserRole.USER]: 0,
  [UserRole.ADMIN]: 1,
  [UserRole.SUPER_ADMIN]: 2,
} as const

/**
 * Check if user has required permission level
 */
export const hasPermission = (userRole: UserRole, requiredRole: UserRole): boolean => {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

/**
 * Check if user is admin or higher
 */
export const isAdmin = (userRole: UserRole): boolean => {
  return hasPermission(userRole, UserRole.ADMIN)
}

/**
 * Check if user is super admin
 */
export const isSuperAdmin = (userRole: UserRole): boolean => {
  return userRole === UserRole.SUPER_ADMIN
}

/**
 * Get user role display name
 */
export const getRoleDisplayName = (role: UserRole): string => {
  switch (role) {
    case UserRole.USER:
      return 'User'
    case UserRole.ADMIN:
      return 'Admin'
    case UserRole.SUPER_ADMIN:
      return 'Super Admin'
    default:
      return 'Unknown'
  }
}

/**
 * Get available roles for user management (based on current user's role)
 */
export const getAvailableRoles = (currentUserRole: UserRole): UserRole[] => {
  if (isSuperAdmin(currentUserRole)) {
    return [UserRole.USER, UserRole.ADMIN, UserRole.SUPER_ADMIN]
  } else if (isAdmin(currentUserRole)) {
    return [UserRole.USER, UserRole.ADMIN]
  } else {
    return [UserRole.USER]
  }
}

/**
 * Check if user can manage another user based on roles
 */
export const canManageUser = (managerRole: UserRole, targetRole: UserRole): boolean => {
  // Super admins can manage anyone
  if (isSuperAdmin(managerRole)) {
    return true
  }
  
  // Admins can manage users but not other admins or super admins
  if (isAdmin(managerRole)) {
    return targetRole === UserRole.USER
  }
  
  // Regular users can't manage anyone
  return false
}

/**
 * Navigation permissions
 */
export const canAccessAdminPanel = (userRole: UserRole): boolean => {
  return isAdmin(userRole)
}

export const canAccessBullMQDashboard = (userRole: UserRole): boolean => {
  return isAdmin(userRole)
}

export const canManageUsers = (userRole: UserRole): boolean => {
  return isAdmin(userRole)
}

export const canAccessSystemSettings = (userRole: UserRole): boolean => {
  return isSuperAdmin(userRole)
}
