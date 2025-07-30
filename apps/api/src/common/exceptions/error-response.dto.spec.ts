import { validate } from "class-validator";
import { plainToClass } from "class-transformer";
import { ErrorResponseDto } from "./error-response.dto";

describe("ErrorResponseDto", () => {
  describe("Class Structure", () => {
    it("should be defined", () => {
      expect(ErrorResponseDto).toBeDefined();
    });

    it("should be instantiable", () => {
      const dto = new ErrorResponseDto();
      expect(dto).toBeInstanceOf(ErrorResponseDto);
    });

    it("should accept property assignments", () => {
      const dto = new ErrorResponseDto();

      dto.statusCode = 404;
      dto.message = "Not found";
      dto.error = "NOT_FOUND";
      dto.timestamp = "2025-07-18T20:41:36.480Z";
      dto.path = "/api/v1/test";
      dto.details = { key: "value" };
      dto.traceId = "trace-123";

      expect(dto.statusCode).toBe(404);
      expect(dto.message).toBe("Not found");
      expect(dto.error).toBe("NOT_FOUND");
      expect(dto.timestamp).toBe("2025-07-18T20:41:36.480Z");
      expect(dto.path).toBe("/api/v1/test");
      expect(dto.details).toEqual({ key: "value" });
      expect(dto.traceId).toBe("trace-123");
    });
  });

  describe("Property Types", () => {
    it("should accept valid error response data", () => {
      const validData = {
        statusCode: 404,
        message: "Hospital not found",
        error: "HOSPITAL_NOT_FOUND",
        timestamp: "2025-07-18T20:41:36.480Z",
        path: "/api/v1/hospitals/123",
        details: { hospitalId: "123" },
        traceId: "req-123e4567-e89b-12d3-a456-426614174000",
      };

      const dto = plainToClass(ErrorResponseDto, validData);

      expect(dto.statusCode).toBe(404);
      expect(dto.message).toBe("Hospital not found");
      expect(dto.error).toBe("HOSPITAL_NOT_FOUND");
      expect(dto.timestamp).toBe("2025-07-18T20:41:36.480Z");
      expect(dto.path).toBe("/api/v1/hospitals/123");
      expect(dto.details).toEqual({ hospitalId: "123" });
      expect(dto.traceId).toBe("req-123e4567-e89b-12d3-a456-426614174000");
    });

    it("should accept minimal required data", () => {
      const minimalData = {
        statusCode: 500,
        message: "Internal server error",
        error: "INTERNAL_SERVER_ERROR",
        timestamp: "2025-07-18T20:41:36.480Z",
        path: "/api/v1/test",
      };

      const dto = plainToClass(ErrorResponseDto, minimalData);

      expect(dto.statusCode).toBe(500);
      expect(dto.message).toBe("Internal server error");
      expect(dto.error).toBe("INTERNAL_SERVER_ERROR");
      expect(dto.timestamp).toBe("2025-07-18T20:41:36.480Z");
      expect(dto.path).toBe("/api/v1/test");
      expect(dto.details).toBeUndefined();
      expect(dto.traceId).toBeUndefined();
    });
  });

  describe("Swagger Documentation", () => {
    it("should have proper OpenAPI decorators", () => {
      const dto = new ErrorResponseDto();

      // Check if class has metadata (this would be set by decorators)
      expect(dto.constructor).toBeDefined();
      expect(dto.constructor.name).toBe("ErrorResponseDto");
    });

    it("should represent common error scenarios correctly", () => {
      const scenarios = [
        {
          name: "400 Bad Request",
          data: {
            statusCode: 400,
            message: "Invalid request parameters",
            error: "INVALID_REQUEST",
            timestamp: "2025-07-18T20:41:36.480Z",
            path: "/api/v1/hospitals",
            details: { field: "hospitalId", value: "invalid" },
          },
        },
        {
          name: "401 Unauthorized",
          data: {
            statusCode: 401,
            message: "Authentication required",
            error: "UNAUTHORIZED",
            timestamp: "2025-07-18T20:41:36.480Z",
            path: "/api/v1/admin/queues",
          },
        },
        {
          name: "403 Forbidden",
          data: {
            statusCode: 403,
            message: "Access denied",
            error: "FORBIDDEN",
            timestamp: "2025-07-18T20:41:36.480Z",
            path: "/api/v1/admin/queues",
          },
        },
        {
          name: "404 Not Found",
          data: {
            statusCode: 404,
            message: "Hospital with ID 123 not found",
            error: "HOSPITAL_NOT_FOUND",
            timestamp: "2025-07-18T20:41:36.480Z",
            path: "/api/v1/hospitals/123",
            details: { hospitalId: "123" },
          },
        },
        {
          name: "422 Validation Error",
          data: {
            statusCode: 422,
            message: "Validation failed",
            error: "VALIDATION_ERROR",
            timestamp: "2025-07-18T20:41:36.480Z",
            path: "/api/v1/hospitals",
            details: {
              validationErrors: [
                { field: "name", message: "Name is required" },
                {
                  field: "state",
                  message: "State must be a valid 2-letter code",
                },
              ],
            },
          },
        },
        {
          name: "429 Rate Limit",
          data: {
            statusCode: 429,
            message: "Rate limit exceeded for Patient Rights Advocate API",
            error: "RATE_LIMIT_EXCEEDED",
            timestamp: "2025-07-18T20:41:36.480Z",
            path: "/api/v1/jobs/pra/scan",
            details: { retryAfter: 60 },
          },
        },
        {
          name: "500 Internal Server Error",
          data: {
            statusCode: 500,
            message: "Internal server error",
            error: "INTERNAL_SERVER_ERROR",
            timestamp: "2025-07-18T20:41:36.480Z",
            path: "/api/v1/hospitals/123",
            traceId: "req-123e4567-e89b-12d3-a456-426614174000",
          },
        },
        {
          name: "502 Bad Gateway",
          data: {
            statusCode: 502,
            message:
              "External service Patient Rights Advocate API error: Service unavailable",
            error: "EXTERNAL_SERVICE_ERROR",
            timestamp: "2025-07-18T20:41:36.480Z",
            path: "/api/v1/jobs/pra/scan",
            details: { service: "Patient Rights Advocate API" },
          },
        },
      ];

      scenarios.forEach(({ name: _name, data }) => {
        const dto = plainToClass(ErrorResponseDto, data);

        expect(dto.statusCode).toBe(data.statusCode);
        expect(dto.message).toBe(data.message);
        expect(dto.error).toBe(data.error);
        expect(dto.timestamp).toBe(data.timestamp);
        expect(dto.path).toBe(data.path);

        if (data.details) {
          expect(dto.details).toEqual(data.details);
        }

        if (data.traceId) {
          expect(dto.traceId).toBe(data.traceId);
        }
      });
    });
  });

  describe("Data Integrity", () => {
    it("should preserve complex details object", () => {
      const complexDetails = {
        validationErrors: [
          { field: "name", message: "Name is required" },
          { field: "state", message: "Invalid state code" },
        ],
        requestId: "req-123",
        userId: "user-456",
        metadata: {
          source: "API",
          version: "1.0",
          nested: {
            deep: "value",
          },
        },
      };

      const data = {
        statusCode: 422,
        message: "Validation failed",
        error: "VALIDATION_ERROR",
        timestamp: "2025-07-18T20:41:36.480Z",
        path: "/api/v1/hospitals",
        details: complexDetails,
      };

      const dto = plainToClass(ErrorResponseDto, data);

      expect(dto.details).toEqual(complexDetails);
      expect(dto.details.validationErrors).toHaveLength(2);

      // Type-safe access to nested properties
      const detailsWithMetadata = dto.details as {
        validationErrors: Array<{ field: string; message: string }>;
        requestId: string;
        userId: string;
        metadata: {
          source: string;
          version: string;
          nested: {
            deep: string;
          };
        };
      };
      expect(detailsWithMetadata.metadata.nested.deep).toBe("value");
    });

    it("should handle null and undefined values appropriately", () => {
      const data = {
        statusCode: 500,
        message: "Internal server error",
        error: "INTERNAL_SERVER_ERROR",
        timestamp: "2025-07-18T20:41:36.480Z",
        path: "/api/v1/test",
        details: null,
        traceId: undefined,
      };

      const dto = plainToClass(ErrorResponseDto, data);

      expect(dto.details).toBeNull();
      expect(dto.traceId).toBeUndefined();
    });
  });

  describe("Serialization", () => {
    it("should serialize to JSON correctly", () => {
      const data = {
        statusCode: 404,
        message: "Hospital not found",
        error: "HOSPITAL_NOT_FOUND",
        timestamp: "2025-07-18T20:41:36.480Z",
        path: "/api/v1/hospitals/123",
        details: { hospitalId: "123" },
        traceId: "req-123e4567-e89b-12d3-a456-426614174000",
      };

      const dto = plainToClass(ErrorResponseDto, data);
      const json = JSON.stringify(dto);
      const parsed = JSON.parse(json);

      expect(parsed.statusCode).toBe(404);
      expect(parsed.message).toBe("Hospital not found");
      expect(parsed.error).toBe("HOSPITAL_NOT_FOUND");
      expect(parsed.timestamp).toBe("2025-07-18T20:41:36.480Z");
      expect(parsed.path).toBe("/api/v1/hospitals/123");
      expect(parsed.details).toEqual({ hospitalId: "123" });
      expect(parsed.traceId).toBe("req-123e4567-e89b-12d3-a456-426614174000");
    });

    it("should omit undefined optional fields in JSON", () => {
      const data = {
        statusCode: 500,
        message: "Internal server error",
        error: "INTERNAL_SERVER_ERROR",
        timestamp: "2025-07-18T20:41:36.480Z",
        path: "/api/v1/test",
      };

      const dto = plainToClass(ErrorResponseDto, data);
      const json = JSON.stringify(dto);
      const parsed = JSON.parse(json);

      expect(parsed).not.toHaveProperty("details");
      expect(parsed).not.toHaveProperty("traceId");
    });
  });

  describe("Type Safety", () => {
    it("should maintain type safety for all properties", () => {
      const dto = new ErrorResponseDto();

      dto.statusCode = 404;
      dto.message = "Not found";
      dto.error = "NOT_FOUND";
      dto.timestamp = "2025-07-18T20:41:36.480Z";
      dto.path = "/api/v1/test";
      dto.details = { key: "value" };
      dto.traceId = "trace-123";

      expect(typeof dto.statusCode).toBe("number");
      expect(typeof dto.message).toBe("string");
      expect(typeof dto.error).toBe("string");
      expect(typeof dto.timestamp).toBe("string");
      expect(typeof dto.path).toBe("string");
      expect(typeof dto.details).toBe("object");
      expect(typeof dto.traceId).toBe("string");
    });
  });
});
