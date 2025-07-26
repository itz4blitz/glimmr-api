/**
 * Utility Types
 * 
 * Common utility types used across the application
 */

// Make all properties optional recursively
export type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

// Pick only certain fields from a type
export type PickFields<T, K extends keyof T> = Pick<T, K>;

// Omit certain fields from a type
export type OmitFields<T, K extends keyof T> = Omit<T, K>;

// Make certain fields required
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Extract the type of array elements
export type ArrayElement<ArrayType extends readonly unknown[]> = 
  ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

// API Error type
export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
  details?: unknown;
}

// Generic filter types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DateRangeFilter {
  start?: Date | string;
  end?: Date | string;
}

// Type guards
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    'message' in error
  );
}

// Branded types for type safety
export type UUID<T = unknown> = string & { __brand: T };
export type Email = string & { __brand: 'Email' };
export type ISODateString = string & { __brand: 'ISODate' };