/**
 * Database Type Exports
 * 
 * This file exports inferred types from Drizzle schemas
 * These types can be used throughout the application
 */

import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import {
  users,
  userProfiles,
  userPreferences,
  userActivityLogs,
  userSessions,
  userFiles,
} from './index';

// User types
export type SelectUser = InferSelectModel<typeof users>;
export type InsertUser = InferInsertModel<typeof users>;

// Workaround for known issue with $inferSelect across packages
// Use these instead of users.$inferSelect in shared packages
export type UserSelect = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

// Profile types
export type SelectUserProfile = InferSelectModel<typeof userProfiles>;
export type InsertUserProfile = InferInsertModel<typeof userProfiles>;

// Preferences types
export type SelectUserPreferences = InferSelectModel<typeof userPreferences>;
export type InsertUserPreferences = InferInsertModel<typeof userPreferences>;

// Activity log types
export type SelectUserActivityLog = InferSelectModel<typeof userActivityLogs>;
export type InsertUserActivityLog = InferInsertModel<typeof userActivityLogs>;

// Session types
export type SelectUserSession = InferSelectModel<typeof userSessions>;
export type InsertUserSession = InferInsertModel<typeof userSessions>;

// File types
export type SelectUserFile = InferSelectModel<typeof userFiles>;
export type InsertUserFile = InferInsertModel<typeof userFiles>;

// Export all types for convenience
export * from './users';
export * from './user-management';
export * from './hospitals';
export * from './prices';
export * from './analytics';
export * from './jobs';
export * from './notifications';
export * from './rbac';