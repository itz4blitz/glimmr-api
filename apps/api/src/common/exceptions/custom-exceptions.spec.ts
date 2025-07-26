import { HttpStatus } from "@nestjs/common";
import {
  BusinessLogicException,
  HospitalNotFoundException,
  FileNotFoundException,
  InvalidFileFormatException,
  ExternalServiceException,
  RateLimitExceededException,
  DatabaseOperationException,
  ValidationException,
  ConfigurationException,
  JobProcessingException,
} from "./custom-exceptions";

describe("Custom Exceptions", () => {
  describe("BusinessLogicException", () => {
    it("should create exception with default status BAD_REQUEST", () => {
      const exception = new BusinessLogicException("Test message");

      expect(exception.message).toBe("Test message");
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });

    it("should create exception with custom status code", () => {
      const exception = new BusinessLogicException(
        "Test message",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      expect(exception.message).toBe("Test message");
      expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should be an instance of HttpException", () => {
      const exception = new BusinessLogicException("Test message");

      expect(exception).toBeInstanceOf(Error);
    });
  });

  describe("HospitalNotFoundException", () => {
    it("should create exception with hospital ID", () => {
      const hospitalId = "hospital-123";
      const exception = new HospitalNotFoundException(hospitalId);

      expect(exception.message).toBe(
        `Hospital with ID ${hospitalId} not found`,
      );
      expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    });

    it("should inherit from BusinessLogicException", () => {
      const exception = new HospitalNotFoundException("123");

      expect(exception).toBeInstanceOf(BusinessLogicException);
    });
  });

  describe("FileNotFoundException", () => {
    it("should create exception with file name", () => {
      const fileName = "test-file.csv";
      const exception = new FileNotFoundException(fileName);

      expect(exception.message).toBe(`File ${fileName} not found`);
      expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    });

    it("should inherit from BusinessLogicException", () => {
      const exception = new FileNotFoundException("test.txt");

      expect(exception).toBeInstanceOf(BusinessLogicException);
    });
  });

  describe("InvalidFileFormatException", () => {
    it("should create exception with file name and expected format", () => {
      const fileName = "data.txt";
      const expectedFormat = "CSV";
      const exception = new InvalidFileFormatException(
        fileName,
        expectedFormat,
      );

      expect(exception.message).toBe(
        `Invalid file format for ${fileName}. Expected: ${expectedFormat}`,
      );
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });

    it("should inherit from BusinessLogicException", () => {
      const exception = new InvalidFileFormatException("file.txt", "CSV");

      expect(exception).toBeInstanceOf(BusinessLogicException);
    });
  });

  describe("ExternalServiceException", () => {
    it("should create exception with service name only", () => {
      const serviceName = "Patient Rights Advocate API";
      const exception = new ExternalServiceException(serviceName);

      expect(exception.message).toBe(`External service ${serviceName} error`);
      expect(exception.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    });

    it("should create exception with service name and message", () => {
      const serviceName = "Patient Rights Advocate API";
      const message = "Service unavailable";
      const exception = new ExternalServiceException(serviceName, message);

      expect(exception.message).toBe(
        `External service ${serviceName} error: ${message}`,
      );
      expect(exception.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    });

    it("should inherit from BusinessLogicException", () => {
      const exception = new ExternalServiceException("Test API");

      expect(exception).toBeInstanceOf(BusinessLogicException);
    });
  });

  describe("RateLimitExceededException", () => {
    it("should create exception with service name only", () => {
      const service = "Test API";
      const exception = new RateLimitExceededException(service);

      expect(exception.message).toBe(`Rate limit exceeded for ${service}`);
      expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });

    it("should create exception with service name and retry after", () => {
      const service = "Test API";
      const retryAfter = 60;
      const exception = new RateLimitExceededException(service, retryAfter);

      expect(exception.message).toBe(
        `Rate limit exceeded for ${service}. Retry after ${retryAfter} seconds`,
      );
      expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });

    it("should inherit from BusinessLogicException", () => {
      const exception = new RateLimitExceededException("Test API");

      expect(exception).toBeInstanceOf(BusinessLogicException);
    });
  });

  describe("DatabaseOperationException", () => {
    it("should create exception with operation name only", () => {
      const operation = "insert hospital";
      const exception = new DatabaseOperationException(operation);

      expect(exception.message).toBe(`Database operation failed: ${operation}`);
      expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should create exception with operation name and details", () => {
      const operation = "insert hospital";
      const details = "Unique constraint violation";
      const exception = new DatabaseOperationException(operation, details);

      expect(exception.message).toBe(
        `Database operation failed: ${operation}. ${details}`,
      );
      expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should inherit from BusinessLogicException", () => {
      const exception = new DatabaseOperationException("test operation");

      expect(exception).toBeInstanceOf(BusinessLogicException);
    });
  });

  describe("ValidationException", () => {
    it("should create exception with field and value only", () => {
      const field = "email";
      const value = "invalid-email";
      const exception = new ValidationException(field, value);

      expect(exception.message).toBe(
        `Validation failed for field '${field}' with value '${value}'`,
      );
      expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    it("should create exception with field, value, and reason", () => {
      const field = "email";
      const value = "invalid-email";
      const reason = "must be a valid email address";
      const exception = new ValidationException(field, value, reason);

      expect(exception.message).toBe(
        `Validation failed for field '${field}' with value '${value}': ${reason}`,
      );
      expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    it("should handle complex values", () => {
      const field = "data";
      const value = { nested: "object" };
      const exception = new ValidationException(field, value);

      expect(exception.message).toBe(
        `Validation failed for field '${field}' with value '[object Object]'`,
      );
      expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    it("should inherit from BusinessLogicException", () => {
      const exception = new ValidationException("field", "value");

      expect(exception).toBeInstanceOf(BusinessLogicException);
    });
  });

  describe("ConfigurationException", () => {
    it("should create exception with config key", () => {
      const configKey = "DATABASE_URL";
      const exception = new ConfigurationException(configKey);

      expect(exception.message).toBe(
        `Configuration error: ${configKey} is not properly configured`,
      );
      expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should inherit from BusinessLogicException", () => {
      const exception = new ConfigurationException("TEST_CONFIG");

      expect(exception).toBeInstanceOf(BusinessLogicException);
    });
  });

  describe("JobProcessingException", () => {
    it("should create exception with job name only", () => {
      const jobName = "hospital-import";
      const exception = new JobProcessingException(jobName);

      expect(exception.message).toBe(`Job processing failed: ${jobName}`);
      expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should create exception with job name and message", () => {
      const jobName = "hospital-import";
      const message = "Invalid data format";
      const exception = new JobProcessingException(jobName, message);

      expect(exception.message).toBe(
        `Job processing failed: ${jobName}. ${message}`,
      );
      expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should inherit from BusinessLogicException", () => {
      const exception = new JobProcessingException("test-job");

      expect(exception).toBeInstanceOf(BusinessLogicException);
    });
  });

  describe("Exception Hierarchy", () => {
    it("should have proper inheritance chain", () => {
      const exceptions = [
        new HospitalNotFoundException("123"),
        new FileNotFoundException("test.txt"),
        new InvalidFileFormatException("test.txt", "CSV"),
        new ExternalServiceException("API"),
        new RateLimitExceededException("API"),
        new DatabaseOperationException("test"),
        new ValidationException("field", "value"),
        new ConfigurationException("config"),
        new JobProcessingException("job"),
      ];

      exceptions.forEach((exception) => {
        expect(exception).toBeInstanceOf(BusinessLogicException);
        expect(exception).toBeInstanceOf(Error);
      });
    });
  });
});
