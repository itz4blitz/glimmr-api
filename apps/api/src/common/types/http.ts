import { Request } from "express";
import { IncomingMessage } from "http";

export interface ExtendedRequest extends Omit<Request, "id"> {
  id?: string;
  headers: Record<string, string | string[] | undefined>;
  socket: Request["socket"] & {
    remoteAddress?: string;
  };
}

export interface LoggerRequest extends Omit<IncomingMessage, "id"> {
  id?: string;
  headers: Record<string, string | string[] | undefined>;
}

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

export interface SerializedResponse {
  statusCode: number;
  headers?: Record<string, string | string[] | undefined>;
}

export interface SerializedError {
  type?: string;
  message: string;
  statusCode?: number;
  stack?: string;
  code?: string;
}
