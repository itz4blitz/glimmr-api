import { Request } from 'express';
import { IncomingMessage } from 'http';

export interface ExtendedRequest extends Request {
  id?: string;
  headers: Record<string, string | string[] | undefined>;
  connection?: {
    remoteAddress?: string;
  };
}

export interface LoggerRequest extends IncomingMessage {
  id?: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface SerializedRequest {
  id?: string;
  method: string;
  url: string;
  query?: unknown;
  params?: unknown;
  headers: Record<string, string | string[] | undefined>;
  remoteAddress?: string;
  remotePort?: number;
}

export interface SerializedResponse {
  statusCode: number;
}

export interface SerializedError {
  type?: string;
  message: string;
  stack?: string;
  code?: string;
}