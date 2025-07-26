/**
 * Type Generation Strategy for Drizzle ORM
 * 
 * This file demonstrates how to generate types from Drizzle schemas
 * that can be shared between backend and frontend.
 */

import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// Import schemas from the API (you'll need to configure paths)
import type {
  users,
  userProfiles,
  userPreferences,
  userActivityLogs,
  userSessions,
  userFiles,
  roles,
  permissions,
  hospitals,
  prices,
  priceTransparencyFiles,
  analytics,
  jobs,
  jobLogs,
  notifications,
} from '../../apps/api/src/database/schema';

// User-related types
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type UserProfile = InferSelectModel<typeof userProfiles>;
export type NewUserProfile = InferInsertModel<typeof userProfiles>;
export type UserPreferences = InferSelectModel<typeof userPreferences>;
export type UserActivityLog = InferSelectModel<typeof userActivityLogs>;
export type UserSession = InferSelectModel<typeof userSessions>;
export type UserFile = InferSelectModel<typeof userFiles>;

// RBAC types
export type Role = InferSelectModel<typeof roles>;
export type Permission = InferSelectModel<typeof permissions>;

// Hospital and pricing types
export type Hospital = InferSelectModel<typeof hospitals>;
export type Price = InferSelectModel<typeof prices>;
export type PriceTransparencyFile = InferSelectModel<typeof priceTransparencyFiles>;

// Analytics types
export type Analytics = InferSelectModel<typeof analytics>;

// Job types
export type Job = InferSelectModel<typeof jobs>;
export type JobLog = InferSelectModel<typeof jobLogs>;

// Notification types
export type Notification = InferSelectModel<typeof notifications>;

// Enum types that should be shared
export const UserRole = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

// API Response types (these are manually defined based on your API structure)
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// DTO types for API requests/responses
export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  isActive?: boolean;
  emailVerified?: boolean;
}

export interface UpdateUserRoleDto {
  role: UserRoleType;
}

// Complex types that combine multiple tables
export interface UserWithProfile extends User {
  profile?: UserProfile;
  preferences?: UserPreferences;
  role?: Role;
  permissions?: Permission[];
}

// Re-export Zod schemas for validation on frontend
export { z } from 'zod';
export type { ZodSchema } from 'zod';