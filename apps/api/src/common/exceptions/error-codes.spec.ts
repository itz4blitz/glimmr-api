import { ERROR_CODES, ErrorCode } from './error-codes';

describe('Error Codes', () => {
  describe('ERROR_CODES Object', () => {
    it('should be defined', () => {
      expect(ERROR_CODES).toBeDefined();
      expect(typeof ERROR_CODES).toBe('object');
    });

    it('should have all required general error codes', () => {
      const expectedGeneralCodes = [
        'INTERNAL_SERVER_ERROR',
        'INVALID_REQUEST',
        'UNAUTHORIZED',
        'FORBIDDEN',
        'NOT_FOUND',
        'METHOD_NOT_ALLOWED',
        'VALIDATION_ERROR',
      ];

      expectedGeneralCodes.forEach((code) => {
        expect(ERROR_CODES[code]).toBeDefined();
        expect(typeof ERROR_CODES[code]).toBe('string');
      });
    });

    it('should have all required hospital-related error codes', () => {
      const expectedHospitalCodes = [
        'HOSPITAL_NOT_FOUND',
        'HOSPITAL_ALREADY_EXISTS',
        'HOSPITAL_IMPORT_FAILED',
      ];

      expectedHospitalCodes.forEach((code) => {
        expect(ERROR_CODES[code]).toBeDefined();
        expect(typeof ERROR_CODES[code]).toBe('string');
      });
    });

    it('should have all required file-related error codes', () => {
      const expectedFileCodes = [
        'FILE_NOT_FOUND',
        'FILE_UPLOAD_FAILED',
        'FILE_DOWNLOAD_FAILED',
        'INVALID_FILE_FORMAT',
        'FILE_TOO_LARGE',
      ];

      expectedFileCodes.forEach((code) => {
        expect(ERROR_CODES[code]).toBeDefined();
        expect(typeof ERROR_CODES[code]).toBe('string');
      });
    });

    it('should have all required price-related error codes', () => {
      const expectedPriceCodes = [
        'PRICE_DATA_NOT_FOUND',
        'PRICE_PARSING_ERROR',
        'PRICE_VALIDATION_ERROR',
      ];

      expectedPriceCodes.forEach((code) => {
        expect(ERROR_CODES[code]).toBeDefined();
        expect(typeof ERROR_CODES[code]).toBe('string');
      });
    });

    it('should have all required job-related error codes', () => {
      const expectedJobCodes = [
        'JOB_NOT_FOUND',
        'JOB_PROCESSING_FAILED',
        'JOB_ALREADY_RUNNING',
        'QUEUE_UNAVAILABLE',
      ];

      expectedJobCodes.forEach((code) => {
        expect(ERROR_CODES[code]).toBeDefined();
        expect(typeof ERROR_CODES[code]).toBe('string');
      });
    });

    it('should have all required external API error codes', () => {
      const expectedExternalCodes = [
        'EXTERNAL_SERVICE_ERROR',
        'RATE_LIMIT_EXCEEDED',
        'SERVICE_UNAVAILABLE',
        'INVALID_API_RESPONSE',
      ];

      expectedExternalCodes.forEach((code) => {
        expect(ERROR_CODES[code]).toBeDefined();
        expect(typeof ERROR_CODES[code]).toBe('string');
      });
    });

    it('should have all required database error codes', () => {
      const expectedDatabaseCodes = [
        'DATABASE_CONNECTION_ERROR',
        'DATABASE_QUERY_ERROR',
        'DATABASE_CONSTRAINT_ERROR',
      ];

      expectedDatabaseCodes.forEach((code) => {
        expect(ERROR_CODES[code]).toBeDefined();
        expect(typeof ERROR_CODES[code]).toBe('string');
      });
    });

    it('should have all required configuration error codes', () => {
      const expectedConfigCodes = [
        'CONFIGURATION_ERROR',
        'MISSING_ENVIRONMENT_VARIABLE',
      ];

      expectedConfigCodes.forEach((code) => {
        expect(ERROR_CODES[code]).toBeDefined();
        expect(typeof ERROR_CODES[code]).toBe('string');
      });
    });

    it('should have all required analytics error codes', () => {
      const expectedAnalyticsCodes = [
        'ANALYTICS_CALCULATION_ERROR',
        'ANALYTICS_DATA_UNAVAILABLE',
      ];

      expectedAnalyticsCodes.forEach((code) => {
        expect(ERROR_CODES[code]).toBeDefined();
        expect(typeof ERROR_CODES[code]).toBe('string');
      });
    });

    it('should have all required storage error codes', () => {
      const expectedStorageCodes = [
        'STORAGE_CONNECTION_ERROR',
        'STORAGE_OPERATION_FAILED',
        'STORAGE_QUOTA_EXCEEDED',
      ];

      expectedStorageCodes.forEach((code) => {
        expect(ERROR_CODES[code]).toBeDefined();
        expect(typeof ERROR_CODES[code]).toBe('string');
      });
    });
  });

  describe('Error Code Values', () => {
    it('should have consistent naming convention', () => {
      const errorCodes = Object.values(ERROR_CODES);
      
      errorCodes.forEach((code) => {
        // Should be uppercase with underscores
        expect(code).toMatch(/^[A-Z_]+$/);
        // Should not start or end with underscore
        expect(code).not.toMatch(/^_/);
        expect(code).not.toMatch(/_$/);
      });
    });

    it('should have unique error codes', () => {
      const errorCodes = Object.values(ERROR_CODES);
      const uniqueErrorCodes = [...new Set(errorCodes)];
      
      expect(errorCodes.length).toBe(uniqueErrorCodes.length);
    });

    it('should have error codes that match their keys', () => {
      Object.entries(ERROR_CODES).forEach(([key, value]) => {
        expect(key).toBe(value);
      });
    });
  });

  describe('ErrorCode Type', () => {
    it('should accept valid error code values', () => {
      const validCodes: ErrorCode[] = [
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.HOSPITAL_NOT_FOUND,
        ERROR_CODES.FILE_NOT_FOUND,
        ERROR_CODES.VALIDATION_ERROR,
      ];

      validCodes.forEach((code) => {
        expect(typeof code).toBe('string');
        expect(Object.values(ERROR_CODES)).toContain(code);
      });
    });
  });

  describe('Error Code Categories', () => {
    it('should have comprehensive coverage of all application domains', () => {
      const domains = [
        'INTERNAL_SERVER_ERROR', // General
        'HOSPITAL_NOT_FOUND',    // Hospital domain
        'FILE_NOT_FOUND',        // File domain
        'PRICE_DATA_NOT_FOUND',  // Price domain
        'JOB_NOT_FOUND',         // Job domain
        'EXTERNAL_SERVICE_ERROR', // External API domain
        'DATABASE_QUERY_ERROR',  // Database domain
        'CONFIGURATION_ERROR',   // Configuration domain
        'ANALYTICS_CALCULATION_ERROR', // Analytics domain
        'STORAGE_CONNECTION_ERROR', // Storage domain
      ];

      domains.forEach((domain) => {
        expect(ERROR_CODES[domain]).toBeDefined();
      });
    });
  });

  describe('Error Code Documentation', () => {
    it('should have meaningful and descriptive error codes', () => {
      const meaningfulCodes = [
        { code: ERROR_CODES.HOSPITAL_NOT_FOUND, description: 'Hospital entity not found' },
        { code: ERROR_CODES.RATE_LIMIT_EXCEEDED, description: 'API rate limit exceeded' },
        { code: ERROR_CODES.DATABASE_CONNECTION_ERROR, description: 'Database connection failed' },
        { code: ERROR_CODES.INVALID_FILE_FORMAT, description: 'File format is invalid' },
        { code: ERROR_CODES.VALIDATION_ERROR, description: 'Input validation failed' },
      ];

      meaningfulCodes.forEach(({ code, description }) => {
        expect(code).toBeDefined();
        expect(typeof code).toBe('string');
        expect(code.length).toBeGreaterThan(0);
        // Code should be descriptive enough to understand the error
        expect(code.split('_').length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Error Code Completeness', () => {
    it('should have at least 25 error codes for comprehensive coverage', () => {
      const errorCodeCount = Object.keys(ERROR_CODES).length;
      expect(errorCodeCount).toBeGreaterThanOrEqual(25);
    });

    it('should cover all HTTP error scenarios', () => {
      const httpErrorCodes = [
        ERROR_CODES.INVALID_REQUEST,      // 400
        ERROR_CODES.UNAUTHORIZED,         // 401
        ERROR_CODES.FORBIDDEN,            // 403
        ERROR_CODES.NOT_FOUND,            // 404
        ERROR_CODES.METHOD_NOT_ALLOWED,   // 405
        ERROR_CODES.VALIDATION_ERROR,     // 422
        ERROR_CODES.RATE_LIMIT_EXCEEDED,  // 429
        ERROR_CODES.INTERNAL_SERVER_ERROR, // 500
        ERROR_CODES.EXTERNAL_SERVICE_ERROR, // 502
        ERROR_CODES.SERVICE_UNAVAILABLE,  // 503
      ];

      httpErrorCodes.forEach((code) => {
        expect(code).toBeDefined();
        expect(typeof code).toBe('string');
      });
    });
  });
});