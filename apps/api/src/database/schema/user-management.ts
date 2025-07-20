import { pgTable, uuid, varchar, timestamp, boolean, text, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './users';

// User Profiles - Extended user information
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  bio: text('bio'),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  phoneNumber: varchar('phone_number', { length: 20 }),
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  languagePreference: varchar('language_preference', { length: 10 }).default('en'),
  dateOfBirth: timestamp('date_of_birth'),
  company: varchar('company', { length: 100 }),
  jobTitle: varchar('job_title', { length: 100 }),
  city: varchar('city', { length: 100 }),
  country: varchar('country', { length: 100 }),
  website: varchar('website', { length: 200 }),
  linkedinUrl: varchar('linkedin_url', { length: 200 }),
  twitterUrl: varchar('twitter_url', { length: 200 }),
  githubUrl: varchar('github_url', { length: 200 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('user_profiles_user_id_idx').on(table.userId),
  timezoneIdx: index('user_profiles_timezone_idx').on(table.timezone),
  countryIdx: index('user_profiles_country_idx').on(table.country),
}));

// User Sessions - Session management
export const userSessions = pgTable('user_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionToken: varchar('session_token', { length: 255 }).notNull().unique(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  isActive: boolean('is_active').notNull().default(true),
  lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('user_sessions_user_id_idx').on(table.userId),
  sessionTokenIdx: index('user_sessions_token_idx').on(table.sessionToken),
  activeIdx: index('user_sessions_active_idx').on(table.isActive),
  expiresIdx: index('user_sessions_expires_idx').on(table.expiresAt),
}));

// User Activity Logs - Comprehensive audit trail
export const userActivityLogs = pgTable('user_activity_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(), // login, logout, profile_update, etc.
  resourceType: varchar('resource_type', { length: 50 }), // user, profile, settings, etc.
  resourceId: varchar('resource_id', { length: 100 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  metadata: jsonb('metadata'), // Additional context data
  success: boolean('success').notNull().default(true),
  errorMessage: text('error_message'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('user_activity_logs_user_id_idx').on(table.userId),
  actionIdx: index('user_activity_logs_action_idx').on(table.action),
  resourceIdx: index('user_activity_logs_resource_idx').on(table.resourceType, table.resourceId),
  timestampIdx: index('user_activity_logs_timestamp_idx').on(table.timestamp),
  successIdx: index('user_activity_logs_success_idx').on(table.success),
}));

// User Preferences - Application settings and preferences
export const userPreferences = pgTable('user_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  notificationEmail: boolean('notification_email').notNull().default(true),
  notificationPush: boolean('notification_push').notNull().default(true),
  notificationSms: boolean('notification_sms').notNull().default(false),
  themePreference: varchar('theme_preference', { length: 20 }).default('system'), // light, dark, system
  languagePreference: varchar('language_preference', { length: 10 }).default('en'),
  timezonePreference: varchar('timezone_preference', { length: 50 }).default('UTC'),
  dateFormat: varchar('date_format', { length: 20 }).default('MM/DD/YYYY'),
  timeFormat: varchar('time_format', { length: 10 }).default('12h'), // 12h, 24h
  privacySettings: jsonb('privacy_settings'), // Complex privacy preferences
  dashboardLayout: jsonb('dashboard_layout'), // Dashboard customization
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('user_preferences_user_id_idx').on(table.userId),
  themeIdx: index('user_preferences_theme_idx').on(table.themePreference),
  languageIdx: index('user_preferences_language_idx').on(table.languagePreference),
}));

// Password Reset Tokens - Secure password reset functionality
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('password_reset_tokens_user_id_idx').on(table.userId),
  tokenIdx: index('password_reset_tokens_token_idx').on(table.token),
  expiresIdx: index('password_reset_tokens_expires_idx').on(table.expiresAt),
  usedIdx: index('password_reset_tokens_used_idx').on(table.usedAt),
}));

// User Files - File management (avatars, documents, etc.)
export const userFiles = pgTable('user_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  fileType: varchar('file_type', { length: 50 }).notNull(), // avatar, document, etc.
  originalName: varchar('original_name', { length: 255 }).notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(), // Stored filename
  filePath: varchar('file_path', { length: 500 }).notNull(),
  fileSize: integer('file_size').notNull(), // Size in bytes
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  metadata: jsonb('metadata'), // Additional file metadata
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('user_files_user_id_idx').on(table.userId),
  fileTypeIdx: index('user_files_type_idx').on(table.fileType),
  activeIdx: index('user_files_active_idx').on(table.isActive),
  uploadedIdx: index('user_files_uploaded_idx').on(table.uploadedAt),
}));

// Zod schemas for validation
export const insertUserProfileSchema = createInsertSchema(userProfiles, {
  bio: z.string().max(500).optional(),
  phoneNumber: z.string().regex(/^\+?[\d\s\-\(\)]+$/).optional(),
  timezone: z.string().max(50).optional(),
  languagePreference: z.string().max(10).optional(),
  company: z.string().max(100).optional(),
  jobTitle: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  website: z.string().url().optional(),
  linkedinUrl: z.string().url().optional(),
  twitterUrl: z.string().url().optional(),
  githubUrl: z.string().url().optional(),
});

export const insertUserSessionSchema = createInsertSchema(userSessions);
export const insertUserActivityLogSchema = createInsertSchema(userActivityLogs);
export const insertUserPreferencesSchema = createInsertSchema(userPreferences);
export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens);
export const insertUserFileSchema = createInsertSchema(userFiles);

export const selectUserProfileSchema = createSelectSchema(userProfiles);
export const selectUserSessionSchema = createSelectSchema(userSessions);
export const selectUserActivityLogSchema = createSelectSchema(userActivityLogs);
export const selectUserPreferencesSchema = createSelectSchema(userPreferences);
export const selectPasswordResetTokenSchema = createSelectSchema(passwordResetTokens);
export const selectUserFileSchema = createSelectSchema(userFiles);

// Types
export type UserProfile = z.infer<typeof selectUserProfileSchema>;
export type NewUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserSession = z.infer<typeof selectUserSessionSchema>;
export type NewUserSession = z.infer<typeof insertUserSessionSchema>;
export type UserActivityLog = z.infer<typeof selectUserActivityLogSchema>;
export type NewUserActivityLog = z.infer<typeof insertUserActivityLogSchema>;
export type UserPreferences = z.infer<typeof selectUserPreferencesSchema>;
export type NewUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type PasswordResetToken = z.infer<typeof selectPasswordResetTokenSchema>;
export type NewPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type UserFile = z.infer<typeof selectUserFileSchema>;
export type NewUserFile = z.infer<typeof insertUserFileSchema>;

// Combined user data types for API responses
export type UserWithProfile = {
  user: any; // Will be properly typed when we update the users schema
  profile?: UserProfile;
  preferences?: UserPreferences;
  lastActivity?: UserActivityLog;
  fileCount?: number;
};

export type UserListItem = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  profile?: {
    avatarUrl?: string;
    company?: string;
    jobTitle?: string;
  };
  activityCount?: number;
};
