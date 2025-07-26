/**
 * Shared Validation Schemas
 * 
 * Zod schemas that can be used for validation on both frontend and backend
 */

import { z } from 'zod';

// Common field validations
export const emailSchema = z.string().email('Invalid email address');
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');
export const uuidSchema = z.string().uuid('Invalid UUID');
export const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number');
export const urlSchema = z.string().url('Invalid URL');

// User-related validations
export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  phoneNumber: phoneSchema.optional(),
  website: urlSchema.optional(),
  company: z.string().max(100).optional(),
  jobTitle: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
});

// Preference validations
export const userPreferencesSchema = z.object({
  notificationEmail: z.boolean(),
  notificationPush: z.boolean(),
  notificationSms: z.boolean(),
  themePreference: z.enum(['light', 'dark', 'system']),
  languagePreference: z.string(),
  timezonePreference: z.string(),
  dateFormat: z.string().optional(),
  timeFormat: z.enum(['12h', '24h']).optional(),
});

// Filter validations
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const dateRangeSchema = z.object({
  start: z.union([z.string().datetime(), z.date()]).optional(),
  end: z.union([z.string().datetime(), z.date()]).optional(),
}).refine((data) => {
  if (data.start && data.end) {
    const start = new Date(data.start);
    const end = new Date(data.end);
    return start <= end;
  }
  return true;
}, {
  message: "Start date must be before end date",
});

// Export type inference helpers
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type DateRangeInput = z.infer<typeof dateRangeSchema>;