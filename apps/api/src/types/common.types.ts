/**
 * Common type definitions used across the application
 * These replace generic 'unknown' types with specific, type-safe alternatives
 */

/**
 * Generic JSON-serializable value type
 * Represents any value that can be safely serialized to JSON
 */
export type JsonValue = 
  | string 
  | number 
  | boolean 
  | null 
  | JsonObject 
  | JsonArray;

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface JsonArray extends Array<JsonValue> {}

/**
 * Generic record type for API responses and data transfer
 */
export type DataRecord = Record<string, JsonValue>;

/**
 * Request query parameters
 */
export type QueryParams = Record<string, string | string[] | undefined>;

/**
 * Request path parameters
 */
export type PathParams = Record<string, string | undefined>;

/**
 * Generic metadata type for extensible objects
 */
export interface Metadata {
  [key: string]: JsonValue;
}

/**
 * Error object structure
 */
export interface ErrorObject {
  message: string;
  code?: string;
  statusCode?: number;
  stack?: string;
  details?: JsonObject;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Sort parameters
 */
export interface SortParams {
  field: string;
  order: 'asc' | 'desc';
}

/**
 * Filter parameters
 */
export type FilterParams = Record<string, string | number | boolean | string[] | number[] | null>;

/**
 * API response wrapper
 */
export interface ApiResponse<T = JsonValue> {
  data: T;
  meta?: Metadata;
  error?: ErrorObject;
}

/**
 * Batch operation result
 */
export interface BatchResult<T = JsonValue> {
  successful: T[];
  failed: Array<{
    item: T;
    error: ErrorObject;
  }>;
}

/**
 * File data structure
 */
export interface FileData {
  filename: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  path?: string;
  encoding?: string;
}

/**
 * Export data formats
 */
export type ExportFormat = 'csv' | 'json' | 'xlsx' | 'pdf';

/**
 * Job data types
 */
export interface JobData extends JsonObject {
  id?: string;
  name?: string;
  type?: string;
  params?: JsonObject;
}

/**
 * Job options
 */
export interface JobOptions extends JsonObject {
  delay?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}

/**
 * Analytics data point
 */
export interface DataPoint {
  timestamp: Date | string;
  value: number;
  label?: string;
  metadata?: Metadata;
}

/**
 * Resource identifier
 */
export type ResourceId = string | number;

/**
 * Resource type
 */
export type ResourceType = 
  | 'user' 
  | 'hospital' 
  | 'price' 
  | 'job' 
  | 'file' 
  | 'analytics' 
  | 'notification'
  | 'auth'
  | 'profile';

/**
 * HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Sensitive data keys that should be redacted
 */
export const SENSITIVE_KEYS = [
  'password',
  'token',
  'apiKey',
  'secret',
  'authorization',
  'cookie',
  'session',
] as const;

/**
 * Type guard to check if a value is a JsonValue
 */
export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }
  
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).every(isJsonValue);
  }
  
  return false;
}

/**
 * Type guard to check if a value is an ErrorObject
 */
export function isErrorObject(value: unknown): value is ErrorObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as any).message === 'string'
  );
}

/**
 * Safely parse JSON with type checking
 */
export function parseJsonSafe<T extends JsonValue = JsonValue>(text: string): T | null {
  try {
    const parsed = JSON.parse(text);
    return isJsonValue(parsed) ? parsed as T : null;
  } catch {
    return null;
  }
}