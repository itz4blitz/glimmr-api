import { Request } from 'express';
import { users } from '../database/schema';

export interface AuthenticatedUser {
  id: number;
  email: string;
  role?: string;
  permissions?: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export type UserWithoutPassword = Omit<typeof users.$inferSelect, 'password'>;

export interface ActivityMetadata {
  endpoint?: string;
  method?: string;
  duration?: number;
  statusCode?: number;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  bodySize?: number;
  userAgent?: string;
  category?: string;
  importance?: string;
  error?: string;
  errorStack?: string;
  [key: string]: unknown;
}

export interface SanitizedValue {
  [key: string]: string | number | boolean | null | SanitizedValue | SanitizedValue[];
}