import { ExecutionContext, Type } from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces';

export interface MockExecutionContext extends Partial<ExecutionContext> {
  switchToHttp: () => HttpArgumentsHost;
  getClass?: () => Type<any>;
  getHandler?: () => Function;
}

export interface MockHttpArgumentsHost {
  getRequest: () => MockRequest;
  getResponse: () => MockResponse;
  getNext?: () => Function;
}

export interface MockRequest {
  method: string;
  path: string;
  route: { path: string };
  headers: Record<string, string>;
  connection: { remoteAddress: string };
  query?: Record<string, string | string[] | undefined>;
  params?: Record<string, string | undefined>;
  body?: any;
  user?: { id: string; email: string; roles?: string[] };
  url?: string;
  ip?: string;
}

export interface MockResponse {
  setHeader: jest.Mock;
  status: jest.Mock;
  json: jest.Mock;
  send: jest.Mock;
  write: jest.Mock;
  end: jest.Mock;
  headersSent?: boolean;
}

export type MockService<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? jest.Mock : T[K];
};