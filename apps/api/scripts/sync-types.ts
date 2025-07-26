#!/usr/bin/env ts-node

/**
 * Type Synchronization Script
 * 
 * This script generates TypeScript types from Drizzle schemas
 * and copies them to the shared-types package
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

const SHARED_TYPES_PATH = join(__dirname, '../../../packages/shared-types/src/generated-types.ts');

const typeTemplate = `/**
 * Auto-generated types from Drizzle schemas
 * DO NOT EDIT MANUALLY
 * Generated at: ${new Date().toISOString()}
 */

import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// Import all schemas
import {
  users,
  userProfiles,
  userPreferences,
  userActivityLogs,
  userSessions,
  userFiles,
  roles,
  permissions,
  userRoles,
  rolePermissions,
  hospitals,
  prices,
  priceTransparencyFiles,
  analytics,
  jobs,
  jobLogs,
  notifications,
  notificationPreferences,
} from '../../../apps/api/src/database/schema';

// User-related types
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type UserProfile = InferSelectModel<typeof userProfiles>;
export type NewUserProfile = InferInsertModel<typeof userProfiles>;
export type UserPreferences = InferSelectModel<typeof userPreferences>;
export type NewUserPreferences = InferInsertModel<typeof userPreferences>;
export type UserActivityLog = InferSelectModel<typeof userActivityLogs>;
export type NewUserActivityLog = InferInsertModel<typeof userActivityLogs>;
export type UserSession = InferSelectModel<typeof userSessions>;
export type NewUserSession = InferInsertModel<typeof userSessions>;
export type UserFile = InferSelectModel<typeof userFiles>;
export type NewUserFile = InferInsertModel<typeof userFiles>;

// RBAC types
export type Role = InferSelectModel<typeof roles>;
export type NewRole = InferInsertModel<typeof roles>;
export type Permission = InferSelectModel<typeof permissions>;
export type NewPermission = InferInsertModel<typeof permissions>;
export type UserRole = InferSelectModel<typeof userRoles>;
export type RolePermission = InferSelectModel<typeof rolePermissions>;

// Business domain types
export type Hospital = InferSelectModel<typeof hospitals>;
export type NewHospital = InferInsertModel<typeof hospitals>;
export type Price = InferSelectModel<typeof prices>;
export type NewPrice = InferInsertModel<typeof prices>;
export type PriceTransparencyFile = InferSelectModel<typeof priceTransparencyFiles>;
export type NewPriceTransparencyFile = InferInsertModel<typeof priceTransparencyFiles>;

// Analytics types
export type Analytics = InferSelectModel<typeof analytics>;
export type NewAnalytics = InferInsertModel<typeof analytics>;

// Job types
export type Job = InferSelectModel<typeof jobs>;
export type NewJob = InferInsertModel<typeof jobs>;
export type JobLog = InferSelectModel<typeof jobLogs>;
export type NewJobLog = InferInsertModel<typeof jobLogs>;

// Notification types
export type Notification = InferSelectModel<typeof notifications>;
export type NewNotification = InferInsertModel<typeof notifications>;
export type NotificationPreference = InferSelectModel<typeof notificationPreferences>;
export type NewNotificationPreference = InferInsertModel<typeof notificationPreferences>;
`;

// Write the generated types
writeFileSync(SHARED_TYPES_PATH, typeTemplate);

console.log('✅ Types synchronized successfully!');
console.log(`📁 Generated types written to: ${SHARED_TYPES_PATH}`);