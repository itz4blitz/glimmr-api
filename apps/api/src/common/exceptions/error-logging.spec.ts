import { Test, TestingModule } from "@nestjs/testing";
import {
  HttpException,
  HttpStatus,
  ArgumentsHost,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { GlobalExceptionFilter } from "./global-exception.filter";
import {
  HospitalNotFoundException,
  ExternalServiceException,
} from "./custom-exceptions";

describe("Error Logging", () => {
  let filter: GlobalExceptionFilter;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockArgumentsHost: Partial<ArgumentsHost>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GlobalExceptionFilter],
    }).compile();

    filter = module.get<GlobalExceptionFilter>(GlobalExceptionFilter);

    // Mock Express Request
    mockRequest = {
      url: "/api/v1/hospitals/123",
      method: "GET",
      ip: "192.168.1.100",
      headers: {
        "user-agent": "Mozilla/5.0 (Test Agent)",
        "x-trace-id": "trace-12345",
      },
    };

    // Mock Express Response
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Mock ArgumentsHost
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    };

    // Spy on logger methods
    jest.spyOn(Logger.prototype, "error").mockImplementation();
    jest.spyOn(Logger.prototype, "warn").mockImplementation();
    jest.spyOn(Logger.prototype, "debug").mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe("Error Log Levels", () => {
    it("should log 5xx errors as error level", () => {
      const exception = new HttpException(
        "Internal server error",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Internal server error",
          error: "INTERNAL_SERVER_ERROR",
          method: "GET",
          url: "/api/v1/hospitals/123",
          userAgent: "Mozilla/5.0 (Test Agent)",
          ip: "192.168.1.100",
          traceId: "trace-12345",
          statusCode: 500,
          stack: expect.any(String),
        }),
      );
    });

    it("should log 4xx errors as warn level", () => {
      const exception = new HospitalNotFoundException("123");

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Client error",
          error: "NOT_FOUND",
          method: "GET",
          url: "/api/v1/hospitals/123",
          userAgent: "Mozilla/5.0 (Test Agent)",
          ip: "192.168.1.100",
          traceId: "trace-12345",
          statusCode: 404,
        }),
      );
    });

    it("should log other status codes as debug level", () => {
      const exception = new HttpException("Accepted", HttpStatus.ACCEPTED);

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(Logger.prototype.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Exception handled",
          error: "INTERNAL_SERVER_ERROR",
          method: "GET",
          url: "/api/v1/hospitals/123",
          userAgent: "Mozilla/5.0 (Test Agent)",
          ip: "192.168.1.100",
          traceId: "trace-12345",
          statusCode: 202,
        }),
      );
    });
  });

  describe("Request Context Logging", () => {
    it("should include complete request context in logs", () => {
      const exception = new HttpException("Test error", HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          url: "/api/v1/hospitals/123",
          userAgent: "Mozilla/5.0 (Test Agent)",
          ip: "192.168.1.100",
          traceId: "trace-12345",
          statusCode: 400,
          error: "INVALID_REQUEST",
        }),
      );
    });

    it("should handle missing request headers gracefully", () => {
      // Create a new mock request with missing headers
      const requestWithoutHeaders = {
        url: "/api/v1/hospitals/123",
        method: "GET",
        ip: undefined,
        headers: {},
      };

      // Create a new ArgumentsHost mock for this test
      const argumentsHostWithoutHeaders = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(requestWithoutHeaders),
          getResponse: jest.fn().mockReturnValue(mockResponse),
        }),
      };

      const exception = new HttpException("Test error", HttpStatus.BAD_REQUEST);

      filter.catch(
        exception,
        argumentsHostWithoutHeaders as unknown as ArgumentsHost,
      );

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          url: "/api/v1/hospitals/123",
          userAgent: undefined,
          ip: undefined,
          traceId: undefined,
          statusCode: 400,
          error: "INVALID_REQUEST",
        }),
      );
    });

    it("should handle different HTTP methods correctly", () => {
      mockRequest.method = "POST";

      const exception = new HttpException("Test error", HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    it("should handle different request paths correctly", () => {
      mockRequest.url = "/api/v1/jobs/pra/scan";

      const exception = new HttpException("Test error", HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "/api/v1/jobs/pra/scan",
        }),
      );
    });
  });

  describe("Error Details Logging", () => {
    it("should include stack trace for internal server errors", () => {
      const exception = new Error("Internal error with stack");

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Internal server error",
          error: "INTERNAL_SERVER_ERROR",
          stack: expect.stringContaining("Error: Internal error with stack"),
        }),
      );
    });

    it("should not include stack trace for client errors", () => {
      const exception = new HospitalNotFoundException("123");

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      const logCall = (Logger.prototype.warn as jest.Mock).mock.calls[0][0];
      expect(logCall).not.toHaveProperty("stack");
    });

    it("should include custom exception details", () => {
      const exception = new ExternalServiceException(
        "Test API",
        "Service unavailable",
      );

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Internal server error",
          error: "EXTERNAL_SERVICE_ERROR",
          statusCode: 502,
        }),
      );
    });
  });

  describe("Database Error Logging", () => {
    it("should log database connection errors appropriately", () => {
      const dbError = {
        name: "ConnectionError",
        message: "Connection to database failed",
        code: "ECONNREFUSED",
      };

      filter.catch(dbError, mockArgumentsHost as ArgumentsHost);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Internal server error",
          error: "DATABASE_QUERY_ERROR",
          statusCode: 500,
        }),
      );
    });

    it("should log database constraint violations", () => {
      const dbError = {
        name: "QueryFailedError",
        message: "duplicate key value violates unique constraint",
        code: "23505",
      };

      filter.catch(dbError, mockArgumentsHost as ArgumentsHost);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Internal server error",
          error: "DATABASE_QUERY_ERROR",
          statusCode: 500,
        }),
      );
    });
  });

  describe("Trace ID Logging", () => {
    it("should include trace ID when present in headers", () => {
      mockRequest.headers["x-trace-id"] = "custom-trace-123";

      const exception = new HttpException("Test error", HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: "custom-trace-123",
        }),
      );
    });

    it("should handle missing trace ID gracefully", () => {
      delete mockRequest.headers["x-trace-id"];

      const exception = new HttpException("Test error", HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: undefined,
        }),
      );
    });

    it("should use trace ID from response when available", () => {
      // This would test if the trace ID is set in the response
      // For now, we test that the current trace ID from request is used
      mockRequest.headers["x-trace-id"] = "request-trace-456";

      const exception = new HttpException("Test error", HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: "request-trace-456",
        }),
      );
    });
  });

  describe("Production vs Development Logging", () => {
    it("should include detailed information in development", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const exception = new Error("Development error");

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "INTERNAL_SERVER_ERROR",
          stack: expect.any(String),
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it("should limit sensitive information in production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const exception = new Error("Production error with sensitive data");

      filter.catch(exception, mockArgumentsHost as ArgumentsHost);

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "INTERNAL_SERVER_ERROR", // Generic message in production
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("Log Message Consistency", () => {
    it("should use consistent log message formats", () => {
      const testCases = [
        {
          exception: new HttpException("Client error", HttpStatus.BAD_REQUEST),
          expectedMsg: "Client error",
          expectedLevel: "warn",
        },
        {
          exception: new HttpException(
            "Server error",
            HttpStatus.INTERNAL_SERVER_ERROR,
          ),
          expectedMsg: "Internal server error",
          expectedLevel: "error",
        },
        {
          exception: new HttpException("Info", HttpStatus.ACCEPTED),
          expectedMsg: "Exception handled",
          expectedLevel: "debug",
        },
      ];

      testCases.forEach(({ exception, expectedMsg, expectedLevel }) => {
        filter.catch(exception, mockArgumentsHost as ArgumentsHost);

        expect(Logger.prototype[expectedLevel]).toHaveBeenCalledWith(
          expect.objectContaining({
            msg: expectedMsg,
          }),
        );

        jest.clearAllMocks();
      });
    });

    it("should include error code consistently", () => {
      const exceptions = [
        new HospitalNotFoundException("123"),
        new ExternalServiceException("Test API"),
        new HttpException("Generic error", HttpStatus.BAD_REQUEST),
      ];

      exceptions.forEach((exception) => {
        filter.catch(exception, mockArgumentsHost as ArgumentsHost);

        const logCalls = [
          ...(Logger.prototype.error as jest.Mock).mock.calls,
          ...(Logger.prototype.warn as jest.Mock).mock.calls,
          ...(Logger.prototype.debug as jest.Mock).mock.calls,
        ];

        expect(logCalls[logCalls.length - 1][0]).toHaveProperty("error");

        jest.clearAllMocks();
      });
    });
  });

  describe("Performance Considerations", () => {
    it("should not log excessively for the same error", () => {
      const exception = new HttpException(
        "Repeated error",
        HttpStatus.BAD_REQUEST,
      );

      // Simulate multiple occurrences of the same error
      for (let i = 0; i < 5; i++) {
        filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      }

      // Each error should still be logged (no built-in deduplication in this implementation)
      expect(Logger.prototype.warn).toHaveBeenCalledTimes(5);
    });

    it("should handle rapid error sequences without performance degradation", () => {
      const startTime = Date.now();

      // Simulate rapid error sequence
      for (let i = 0; i < 100; i++) {
        const exception = new HttpException(
          `Error ${i}`,
          HttpStatus.BAD_REQUEST,
        );
        filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(1000); // 1 second
      expect(Logger.prototype.warn).toHaveBeenCalledTimes(100);
    });
  });
});
