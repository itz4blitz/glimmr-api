import { Test, TestingModule } from "@nestjs/testing";
import { HttpException, HttpStatus, ArgumentsHost } from "@nestjs/common";
import { Request, Response } from "express";
import { PinoLogger } from "nestjs-pino";
import { GlobalExceptionFilter } from "./global-exception.filter";

// Types for mock objects
type MockPinoLogger = {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
};

type MockRequest = Partial<Request> & {
  url: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
  ip: string;
};

type MockResponse = {
  status: jest.Mock;
  json: jest.Mock;
};

type MockArgumentsHost = {
  switchToHttp: jest.Mock;
  getArgs: jest.Mock;
  getArgByIndex: jest.Mock;
  switchToRpc: jest.Mock;
  switchToWs: jest.Mock;
  getType: jest.Mock;
};

describe("GlobalExceptionFilter", () => {
  let filter: GlobalExceptionFilter;
  let logger: PinoLogger;

  const mockLogger: MockPinoLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const mockRequest: MockRequest = {
    url: "/api/v1/test",
    method: "GET",
    headers: {
      "user-agent": "Mozilla/5.0 (Test Browser)",
      "x-correlation-id": "test-correlation-123",
    },
    ip: "127.0.0.1",
  };

  const mockResponse: MockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  const mockArgumentsHost: MockArgumentsHost = {
    switchToHttp: jest.fn().mockReturnValue({
      getResponse: jest.fn().mockReturnValue(mockResponse),
      getRequest: jest.fn().mockReturnValue(mockRequest),
    }),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn(),
  };

  beforeEach(async () => {
    filter = new GlobalExceptionFilter(mockLogger as unknown as PinoLogger);
    logger = mockLogger as unknown as PinoLogger;
    
    // Set NODE_ENV to test for consistent behavior
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("catch", () => {
    it("should handle HttpException with 400 status", () => {
      const exception = new HttpException(
        "Bad Request",
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost as unknown as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.BAD_REQUEST,
        message: "Bad Request",
        error: "Bad Request",
        timestamp: expect.any(String),
        path: "/api/v1/test",
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        {
          timestamp: expect.any(String),
          path: "/api/v1/test",
          method: "GET",
          statusCode: HttpStatus.BAD_REQUEST,
          message: "Bad Request",
          userAgent: "Mozilla/5.0 (Test Browser)",
          ip: "127.0.0.1",
          correlationId: "test-correlation-123",
        },
        "Client error",
      );
    });

    it("should handle HttpException with object response", () => {
      const exceptionResponse = {
        message: "Validation failed",
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        error: "Unprocessable Entity",
      };
      const exception = new HttpException(
        exceptionResponse,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );

      filter.catch(exception, mockArgumentsHost as unknown as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        message: "Validation failed",
        error: "Unprocessable Entity",
        timestamp: expect.any(String),
        path: "/api/v1/test",
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        {
          timestamp: expect.any(String),
          path: "/api/v1/test",
          method: "GET",
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          message: "Validation failed",
          userAgent: "Mozilla/5.0 (Test Browser)",
          ip: "127.0.0.1",
          correlationId: "test-correlation-123",
        },
        "Client error",
      );
    });

    it("should handle 500 level errors with error logging", () => {
      const exception = new HttpException(
        "Internal Server Error",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      filter.catch(exception, mockArgumentsHost as unknown as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        error: "Internal Server Error",
        timestamp: expect.any(String),
        path: "/api/v1/test",
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          timestamp: expect.any(String),
          path: "/api/v1/test",
          method: "GET",
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "Internal Server Error",
          userAgent: "Mozilla/5.0 (Test Browser)",
          ip: "127.0.0.1",
          correlationId: "test-correlation-123",
          stack: expect.any(String),
          error: "Internal Server Error",
        },
        "Unhandled server error",
      );
    });

    it("should handle non-HttpException errors", () => {
      const exception = new Error("Database connection failed");

      filter.catch(exception, mockArgumentsHost as unknown as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal server error",
        error: "Internal Server Error",
        timestamp: expect.any(String),
        path: "/api/v1/test",
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          timestamp: expect.any(String),
          path: "/api/v1/test",
          method: "GET",
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "Internal server error",
          userAgent: "Mozilla/5.0 (Test Browser)",
          ip: "127.0.0.1",
          correlationId: "test-correlation-123",
          stack: expect.any(String),
          error: "Database connection failed",
        },
        "Unhandled server error",
      );
    });

    it("should handle unknown exception types", () => {
      const exception = "String exception";

      filter.catch(exception, mockArgumentsHost as unknown as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal server error",
        error: "Internal Server Error",
        timestamp: expect.any(String),
        path: "/api/v1/test",
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        {
          timestamp: expect.any(String),
          path: "/api/v1/test",
          method: "GET",
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "Internal server error",
          userAgent: "Mozilla/5.0 (Test Browser)",
          ip: "127.0.0.1",
          correlationId: "test-correlation-123",
          stack: undefined,
          error: "String exception",
        },
        "Unhandled server error",
      );
    });

    it("should handle missing correlation ID", () => {
      const mockRequestWithoutCorrelation: MockRequest = {
        ...mockRequest,
        headers: {
          "user-agent": "Mozilla/5.0 (Test Browser)",
        },
      };

      const mockArgumentsHostWithoutCorrelation: MockArgumentsHost = {
        switchToHttp: jest.fn().mockReturnValue({
          getResponse: jest.fn().mockReturnValue(mockResponse),
          getRequest: jest.fn().mockReturnValue(mockRequestWithoutCorrelation),
        }),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
        getType: jest.fn(),
      };

      const exception = new HttpException(
        "Bad Request",
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHostWithoutCorrelation as unknown as ArgumentsHost);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        {
          timestamp: expect.any(String),
          path: "/api/v1/test",
          method: "GET",
          statusCode: HttpStatus.BAD_REQUEST,
          message: "Bad Request",
          userAgent: "Mozilla/5.0 (Test Browser)",
          ip: "127.0.0.1",
          correlationId: "unknown",
        },
        "Client error",
      );
    });

    it("should include stack trace in development mode", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const exception = new Error("Development error");

      filter.catch(exception, mockArgumentsHost as unknown as ArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal server error",
        error: "Internal Server Error",
        timestamp: expect.any(String),
        path: "/api/v1/test",
        stack: expect.any(String),
      });

      process.env.NODE_ENV = originalEnv;
    });

    it("should not include stack trace in production mode", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const exception = new Error("Production error");

      filter.catch(exception, mockArgumentsHost as unknown as ArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal server error",
        error: "Internal Server Error",
        timestamp: expect.any(String),
        path: "/api/v1/test",
      });

      process.env.NODE_ENV = originalEnv;
    });

    it("should handle 300 level responses with info logging", () => {
      const exception = new HttpException("Multiple Choices", 300);

      filter.catch(exception, mockArgumentsHost as unknown as ArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(300);
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          timestamp: expect.any(String),
          path: "/api/v1/test",
          method: "GET",
          statusCode: 300,
          message: "Multiple Choices",
          userAgent: "Mozilla/5.0 (Test Browser)",
          ip: "127.0.0.1",
          correlationId: "test-correlation-123",
        },
        "Request processed with warning",
      );
    });
  });

  describe("getErrorName", () => {
    it("should return correct error names for common status codes", () => {
      const filterWithPrivate = filter as any;
      expect(filterWithPrivate.getErrorName(HttpStatus.BAD_REQUEST)).toBe(
        "Bad Request",
      );
      expect(filterWithPrivate.getErrorName(HttpStatus.UNAUTHORIZED)).toBe(
        "Unauthorized",
      );
      expect(filterWithPrivate.getErrorName(HttpStatus.FORBIDDEN)).toBe(
        "Forbidden",
      );
      expect(filterWithPrivate.getErrorName(HttpStatus.NOT_FOUND)).toBe(
        "Not Found",
      );
      expect(filterWithPrivate.getErrorName(HttpStatus.CONFLICT)).toBe(
        "Conflict",
      );
      expect(
        filterWithPrivate.getErrorName(HttpStatus.UNPROCESSABLE_ENTITY),
      ).toBe("Unprocessable Entity");
      expect(filterWithPrivate.getErrorName(HttpStatus.TOO_MANY_REQUESTS)).toBe(
        "Too Many Requests",
      );
      expect(
        filterWithPrivate.getErrorName(HttpStatus.INTERNAL_SERVER_ERROR),
      ).toBe("Internal Server Error");
      expect(filterWithPrivate.getErrorName(HttpStatus.BAD_GATEWAY)).toBe(
        "Bad Gateway",
      );
      expect(filterWithPrivate.getErrorName(HttpStatus.SERVICE_UNAVAILABLE)).toBe(
        "Service Unavailable",
      );
      expect(filterWithPrivate.getErrorName(HttpStatus.GATEWAY_TIMEOUT)).toBe(
        "Gateway Timeout",
      );
    });

    it('should return "Unknown Error" for unrecognized status codes', () => {
      const filterWithPrivate = filter as any;
      expect(filterWithPrivate.getErrorName(999)).toBe("Unknown Error");
      expect(filterWithPrivate.getErrorName(123)).toBe("Unknown Error");
    });
  });

  describe("message extraction", () => {
    it("should extract message from object response", () => {
      const exceptionResponse = {
        message: "Custom validation error",
        error: "Bad Request",
      };
      const exception = new HttpException(
        exceptionResponse,
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost as unknown as ArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Custom validation error",
        }),
      );
    });

    it("should handle object response without message", () => {
      const exceptionResponse = {
        error: "Bad Request",
        details: "Some details",
      };
      const exception = new HttpException(
        exceptionResponse,
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost as unknown as ArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Unknown error",
        }),
      );
    });

    it("should handle string response", () => {
      const exception = new HttpException(
        "Simple string error",
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost as unknown as ArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Simple string error",
        }),
      );
    });
  });
});
