import type { Request, Response, NextFunction } from "express";
import type { ExecutionContext } from "@nestjs/common";
import type { Socket } from "socket.io";

export function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    query: {},
    params: {},
    body: {},
    user: undefined,
    method: "GET",
    url: "/",
    get: jest.fn(),
    header: jest.fn(),
    accepts: jest.fn(),
    acceptsCharsets: jest.fn(),
    acceptsEncodings: jest.fn(),
    acceptsLanguages: jest.fn(),
    ...overrides,
  } as Request;
}

export function createMockResponse(): Response {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    getHeader: jest.fn(),
    getHeaders: jest.fn().mockReturnValue({}),
    headersSent: false,
    end: jest.fn(),
    write: jest.fn(),
    redirect: jest.fn(),
  } as unknown as Response;
  return res;
}

export function createMockNextFunction(): NextFunction {
  return jest.fn() as NextFunction;
}

export function createMockExecutionContext(
  request: Partial<Request> = {},
  response: Partial<Response> = {},
): ExecutionContext {
  const mockRequest = createMockRequest(request);
  const mockResponse = createMockResponse();

  return {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(mockRequest),
      getResponse: jest.fn().mockReturnValue(mockResponse),
      getNext: jest.fn().mockReturnValue(jest.fn()),
    }),
    getClass: jest.fn(),
    getHandler: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn().mockReturnValue("http"),
  } as ExecutionContext;
}

export function createMockSocket(overrides: Partial<Socket> = {}): Socket {
  return {
    id: "mock-socket-id",
    emit: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    off: jest.fn(),
    disconnect: jest.fn(),
    handshake: {
      auth: {},
      headers: {},
      query: {},
    },
    ...overrides,
  } as Socket;
}
