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
  query?: SanitizedValue;
  params?: SanitizedValue;
  bodySize?: number;
  userAgent?: string;
  category?: string;
  importance?: string;
  error?: string;
  errorStack?: string;
  [key: string]: string | number | boolean | Record<string, any> | SanitizedValue | undefined;
}

export interface SanitizedValue {
  [key: string]: string | number | boolean | null | string[] | SanitizedValue | SanitizedValue[];
}