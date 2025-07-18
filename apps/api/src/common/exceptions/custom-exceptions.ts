import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessLogicException extends HttpException {
  constructor(message: string, statusCode: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(message, statusCode);
  }
}

export class HospitalNotFoundException extends BusinessLogicException {
  constructor(hospitalId: string) {
    super(`Hospital with ID ${hospitalId} not found`, HttpStatus.NOT_FOUND);
  }
}

export class FileNotFoundException extends BusinessLogicException {
  constructor(fileName: string) {
    super(`File ${fileName} not found`, HttpStatus.NOT_FOUND);
  }
}

export class InvalidFileFormatException extends BusinessLogicException {
  constructor(fileName: string, expectedFormat: string) {
    super(
      `Invalid file format for ${fileName}. Expected: ${expectedFormat}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class ExternalServiceException extends BusinessLogicException {
  constructor(serviceName: string, message?: string) {
    super(
      `External service ${serviceName} error${message ? `: ${message}` : ''}`,
      HttpStatus.BAD_GATEWAY,
    );
  }
}

export class RateLimitExceededException extends BusinessLogicException {
  constructor(service: string, retryAfter?: number) {
    super(
      `Rate limit exceeded for ${service}${
        retryAfter ? `. Retry after ${retryAfter} seconds` : ''
      }`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class DatabaseOperationException extends BusinessLogicException {
  constructor(operation: string, details?: string) {
    super(
      `Database operation failed: ${operation}${details ? `. ${details}` : ''}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export class ValidationException extends BusinessLogicException {
  constructor(field: string, value: any, reason?: string) {
    super(
      `Validation failed for field '${field}' with value '${value}'${
        reason ? `: ${reason}` : ''
      }`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class ConfigurationException extends BusinessLogicException {
  constructor(configKey: string) {
    super(
      `Configuration error: ${configKey} is not properly configured`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export class JobProcessingException extends BusinessLogicException {
  constructor(jobName: string, message?: string) {
    super(
      `Job processing failed: ${jobName}${message ? `. ${message}` : ''}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}