// Export all schemas
export * from './hospitals';
export * from './prices';
export * from './price-transparency-files';
export * from './analytics';
export * from './jobs';
export * from './job-configurations';
export * from './users';
export * from './rbac';
export * from './user-management';
export * from './notifications';

// Re-export for convenience
import { hospitals } from './hospitals';
import { prices } from './prices';
import { priceTransparencyFiles } from './price-transparency-files';
import { analytics } from './analytics';
import { jobs, jobLogs } from './jobs';
import { jobTemplates, jobSchedules, jobQueueConfigs } from './job-configurations';
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
import { notifications, notificationPreferences } from './notifications';

export const schema = {
  hospitals,
  prices,
  priceTransparencyFiles,
  analytics,
  jobs,
  jobLogs,
  jobTemplates,
  jobSchedules,
  jobQueueConfigs,
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
  notifications,
  notificationPreferences,
};

export type Schema = typeof schema;
