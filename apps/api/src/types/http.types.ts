/**
 * HTTP-specific type definitions
 * These types replace generic 'unknown' types in HTTP handling
 */

import { Request } from "express";
import { IncomingMessage } from "http";
import { JsonValue, JsonObject } from "./common.types";

/**
 * Extended request with proper typing
 */
export interface ExtendedRequest
  extends Omit<Request, "id" | "query" | "params" | "body"> {
  id?: string;
  headers: Record<string, string | string[] | undefined>;
  socket: Request["socket"] & {
    remoteAddress?: string;
  };
  query: Record<string, string | string[] | undefined>;
  params: Record<string, string>;
  body: JsonObject;
}

/**
 * Logger request interface
 */
export interface LoggerRequest extends Omit<IncomingMessage, "id"> {
  id?: string;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Serialized request for logging
 */
export interface SerializedRequest {
  id?: string;
  method: string;
  url: string;
  query?: Record<string, string | string[] | undefined>;
  params?: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
  remoteAddress?: string;
  remotePort?: number;
}

/**
 * Serialized response for logging
 */
export interface SerializedResponse {
  statusCode: number;
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * Serialized error for logging
 */
export interface SerializedError {
  type?: string;
  message: string;
  statusCode?: number;
  stack?: string;
  code?: string;
}

/**
 * Response methods for DTO
 */
export interface ResponseMethods {
  json: (data: JsonValue) => void;
  send: (data: string | Buffer | JsonValue) => void;
  setHeader: (key: string, value: string | string[]) => void;
}

/**
 * Passport done callback signature
 */
export type PassportDoneCallback<TUser = any> = (
  error: Error | null,
  user?: TUser | false,
  info?: { message: string } | string,
) => void;

/**
 * API key validation result
 */
export interface ApiKeyUser {
  id: string;
  email: string;
  role: string;
}

/**
 * HTTP error response
 */
export interface HttpErrorResponse {
  statusCode: number;
  message: string;
  error?: string;
  details?: JsonObject;
  timestamp?: string;
  path?: string;
}

/**
 * Request metadata for logging
 */
export interface RequestMetadata {
  endpoint: string;
  method: string;
  duration: number;
  statusCode: number;
  query?: Record<string, string | string[] | undefined>;
  params?: Record<string, string>;
  bodySize?: number;
  userAgent?: string;
  ip?: string;
  userId?: string;
}

/**
 * Type guards
 */
export function isExtendedRequest(req: any): req is ExtendedRequest {
  return req && typeof req === "object" && "method" in req && "url" in req;
}

export function isHttpErrorResponse(value: any): value is HttpErrorResponse {
  return (
    value &&
    typeof value === "object" &&
    typeof value.statusCode === "number" &&
    typeof value.message === "string"
  );
}
