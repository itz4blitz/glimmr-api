// Export all schemas
export * from './hospitals';
export * from './prices';
export * from './price-transparency-files';
export * from './analytics';
export * from './jobs';
export * from './users';
export * from './rbac';
export * from './user-management';

// Re-export for convenience
import { hospitals } from './hospitals';
import { prices } from './prices';
import { priceTransparencyFiles } from './price-transparency-files';
import { analytics } from './analytics';
import { jobs, jobLogs } from './jobs';
import { users } from './users';
import { roles, permissions, userRoles, rolePermissions } from './rbac';
import {
  userProfiles,
  userSessions,
  userActivityLogs,
  userPreferences,
  passwordResetTokens,
  userFiles
} from './user-management';

export const schema = {
  hospitals,
  prices,
  priceTransparencyFiles,
  analytics,
  jobs,
  jobLogs,
  users,
  roles,
  permissions,
  userRoles,
  rolePermissions,
  userProfiles,
  userSessions,
  userActivityLogs,
  userPreferences,
  passwordResetTokens,
  userFiles,
};

export type Schema = typeof schema;
