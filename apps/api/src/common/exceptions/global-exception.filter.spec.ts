import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { Request, Response } from 'express';
import { GlobalExceptionFilter } from './global-exception.filter';
import { ERROR_CODES } from './error-codes';
import { 
  HospitalNotFoundException, 
  ExternalServiceException, 
  ValidationException 
} from './custom-exceptions';

describe('GlobalExceptionFilter', () => {
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
      url: '/api/v1/hospitals/123',
      method: 'GET',
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'Mozilla/5.0 (Test Agent)',
        'x-trace-id': 'test-trace-id-123',
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Filter Initialization', () => {
    it('should be defined', () => {
      expect(filter).toBeDefined();
    });

    it('should be an instance of GlobalExceptionFilter', () => {
      expect(filter).toBeInstanceOf(GlobalExceptionFilter);
    });
  });

  describe('HTTP Exception Handling', () => {
    it('should handle HttpException with simple message', () => {
      const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);
      
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 404,
        message: 'Not found',
        error: ERROR_CODES.NOT_FOUND,
        timestamp: expect.any(String),
        path: '/api/v1/hospitals/123',
        details: undefined,
        traceId: 'test-trace-id-123',
      });
    });

    it('should handle HttpException with object response', () => {
      const exception = new HttpException({
        message: 'Validation failed',
        errors: ['Name is required', 'State is invalid'],
      }, HttpStatus.BAD_REQUEST);
      
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 400,
        message: 'Validation failed',
        error: ERROR_CODES.INVALID_REQUEST,
        timestamp: expect.any(String),
        path: '/api/v1/hospitals/123',
        details: { errors: ['Name is required', 'State is invalid'] },
        traceId: 'test-trace-id-123',
      });
    });

    it('should handle HttpException with array message', () => {
      const exception = new HttpException({
        message: ['Name is required', 'State is invalid'],
      }, HttpStatus.BAD_REQUEST);
      
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 400,
        message: 'Name is required, State is invalid',
        error: ERROR_CODES.INVALID_REQUEST,
        timestamp: expect.any(String),
        path: '/api/v1/hospitals/123',
        details: undefined,
        traceId: 'test-trace-id-123',
      });
    });
  });

  describe('Custom Exception Handling', () => {
    it('should handle HospitalNotFoundException', () => {
      const exception = new HospitalNotFoundException('123');
      
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 404,
        message: 'Hospital with ID 123 not found',
        error: ERROR_CODES.NOT_FOUND,
        timestamp: expect.any(String),
        path: '/api/v1/hospitals/123',
        details: undefined,
        traceId: 'test-trace-id-123',
      });
    });

    it('should handle ExternalServiceException', () => {
      const exception = new ExternalServiceException('Patient Rights Advocate API', 'Service unavailable');
      
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      
      expect(mockResponse.status).toHaveBeenCalledWith(502);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 502,
        message: 'External service Patient Rights Advocate API error: Service unavailable',
        error: ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        timestamp: expect.any(String),
        path: '/api/v1/hospitals/123',
        details: undefined,
        traceId: 'test-trace-id-123',
      });
    });

    it('should handle ValidationException', () => {
      const exception = new ValidationException('email', 'invalid-email', 'must be a valid email');
      
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      
      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 422,
        message: "Validation failed for field 'email' with value 'invalid-email': must be a valid email",
        error: ERROR_CODES.VALIDATION_ERROR,
        timestamp: expect.any(String),
        path: '/api/v1/hospitals/123',
        details: undefined,
        traceId: 'test-trace-id-123',
      });
    });
  });

  describe('Validation Error Handling', () => {
    it('should handle NestJS validation errors', () => {
      const exception = new HttpException({
        message: [
          'name should not be empty',
          'state must be a valid state code',
        ],
        error: 'Unprocessable Entity',
        statusCode: 422,
      }, HttpStatus.UNPROCESSABLE_ENTITY);
      
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      
      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 422,
        message: 'name should not be empty, state must be a valid state code',
        error: ERROR_CODES.VALIDATION_ERROR,
        timestamp: expect.any(String),
        path: '/api/v1/hospitals/123',
        details: undefined,
        traceId: 'test-trace-id-123',
      });
    });

    it('should handle class-validator validation errors', () => {
      const exception = new HttpException({
        message: [
          { property: 'name', constraints: { isNotEmpty: 'name should not be empty' } },
          { property: 'state', constraints: { isLength: 'state must be 2 characters' } },
        ],
        error: 'Unprocessable Entity',
        statusCode: 422,
      }, HttpStatus.UNPROCESSABLE_ENTITY);
      
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      
      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 422,
        message: '[object Object], [object Object]',
        error: ERROR_CODES.VALIDATION_ERROR,
        timestamp: expect.any(String),
        path: '/api/v1/hospitals/123',
        details: undefined,
        traceId: 'test-trace-id-123',
      });
    });
  });

  describe('Database Error Handling', () => {
    it('should handle PostgreSQL constraint violation', () => {
      const exception = {
        name: 'QueryFailedError',
        message: 'duplicate key value violates unique constraint',
        code: '23505',
        constraint: 'hospitals_ccn_unique',
      };
      
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'Database operation failed',
        error: ERROR_CODES.DATABASE_QUERY_ERROR,
        timestamp: expect.any(String),
        path: '/api/v1/hospitals/123',
        details: undefined, // Should be undefined in production
        traceId: 'test-trace-id-123',
      });
    });

    it('should handle database connection errors', () => {
      const exception = {
        name: 'ConnectionError',
        message: 'Connection terminated',
        code: 'ECONNREFUSED',
      };
      
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'Database operation failed',
        error: ERROR_CODES.DATABASE_QUERY_ERROR,
        timestamp: expect.any(String),
        path: '/api/v1/hospitals/123',
        details: undefined,
        traceId: 'test-trace-id-123',
      });
    });
  });

  describe('Generic Error Handling', () => {
    it('should handle generic errors in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const exception = new Error('Some internal error');
      
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'Internal server error',
        error: ERROR_CODES.INTERNAL_SERVER_ERROR,
        timestamp: expect.any(String),
        path: '/api/v1/hospitals/123',
        details: undefined,
        traceId: 'test-trace-id-123',
      });
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle generic errors in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const exception = new Error('Some internal error');
      
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'Some internal error',
        error: ERROR_CODES.INTERNAL_SERVER_ERROR,
        timestamp: expect.any(String),
        path: '/api/v1/hospitals/123',
        details: {
          stack: expect.any(String),
          name: 'Error',
        },
        traceId: 'test-trace-id-123',
      });
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle exceptions without message', () => {
      const exception = new Error();
      
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'Unknown error',
        error: ERROR_CODES.INTERNAL_SERVER_ERROR,
        timestamp: expect.any(String),
        path: '/api/v1/hospitals/123',
        details: expect.any(Object),
        traceId: 'test-trace-id-123',
      });
    });
  });

  describe('HTTP Status Code Mapping', () => {
    const statusCodeMappings = [
      { status: HttpStatus.BAD_REQUEST, expected: ERROR_CODES.INVALID_REQUEST },
      { status: HttpStatus.UNAUTHORIZED, expected: ERROR_CODES.UNAUTHORIZED },
      { status: HttpStatus.FORBIDDEN, expected: ERROR_CODES.FORBIDDEN },
      { status: HttpStatus.NOT_FOUND, expected: ERROR_CODES.NOT_FOUND },
      { status: HttpStatus.METHOD_NOT_ALLOWED, expected: ERROR_CODES.METHOD_NOT_ALLOWED },
      { status: HttpStatus.UNPROCESSABLE_ENTITY, expected: ERROR_CODES.VALIDATION_ERROR },
      { status: HttpStatus.TOO_MANY_REQUESTS, expected: ERROR_CODES.RATE_LIMIT_EXCEEDED },
      { status: HttpStatus.INTERNAL_SERVER_ERROR, expected: ERROR_CODES.INTERNAL_SERVER_ERROR },
      { status: HttpStatus.BAD_GATEWAY, expected: ERROR_CODES.EXTERNAL_SERVICE_ERROR },
      { status: HttpStatus.SERVICE_UNAVAILABLE, expected: ERROR_CODES.SERVICE_UNAVAILABLE },
    ];

    statusCodeMappings.forEach(({ status, expected }) => {
      it(`should map ${status} to ${expected}`, () => {
        const exception = new HttpException('Test message', status);
        
        filter.catch(exception, mockArgumentsHost as ArgumentsHost);
        
        expect(mockResponse.status).toHaveBeenCalledWith(status);
        expect(mockResponse.json).toHaveBeenCalledWith({
          statusCode: status,
          message: 'Test message',
          error: expected,
          timestamp: expect.any(String),
          path: '/api/v1/hospitals/123',
          details: undefined,
          traceId: 'test-trace-id-123',
        });
      });
    });
  });

  describe('Request Context Handling', () => {
    it('should handle request without trace ID', () => {
      mockRequest.headers = { 'user-agent': 'Test Agent' };
      
      const exception = new HttpException('Test message', HttpStatus.BAD_REQUEST);
      
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 400,
        message: 'Test message',
        error: ERROR_CODES.INVALID_REQUEST,
        timestamp: expect.any(String),
        path: '/api/v1/hospitals/123',
        details: undefined,
        traceId: undefined,
      });
    });

    it('should handle different request paths', () => {
      mockRequest.url = '/api/v1/jobs/pra/scan';
      
      const exception = new HttpException('Test message', HttpStatus.BAD_REQUEST);
      
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 400,
        message: 'Test message',
        error: ERROR_CODES.INVALID_REQUEST,
        timestamp: expect.any(String),
        path: '/api/v1/jobs/pra/scan',
        details: undefined,
        traceId: 'test-trace-id-123',
      });
    });
  });

  describe('Timestamp Validation', () => {
    it('should generate valid ISO 8601 timestamps', () => {
      const exception = new HttpException('Test message', HttpStatus.BAD_REQUEST);
      
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      
      const call = (mockResponse.json as jest.Mock).mock.calls[0][0];
      const timestamp = call.timestamp;
      
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('should generate different timestamps for different errors', (done) => {
      const exception1 = new HttpException('First error', HttpStatus.BAD_REQUEST);
      const exception2 = new HttpException('Second error', HttpStatus.BAD_REQUEST);
      
      filter.catch(exception1, mockArgumentsHost as ArgumentsHost);
      const firstTimestamp = (mockResponse.json as jest.Mock).mock.calls[0][0].timestamp;
      
      // Wait a small amount to ensure different timestamps
      setTimeout(() => {
        filter.catch(exception2, mockArgumentsHost as ArgumentsHost);
        const secondTimestamp = (mockResponse.json as jest.Mock).mock.calls[1][0].timestamp;
        
        expect(firstTimestamp).not.toBe(secondTimestamp);
        done();
      }, 2);
    });
  });

  describe('Error Message Extraction', () => {
    it('should extract message from string response', () => {
      const exception = new HttpException('Simple string message', HttpStatus.BAD_REQUEST);
      
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      
      const call = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(call.message).toBe('Simple string message');
    });

    it('should extract message from object response', () => {
      const exception = new HttpException({
        message: 'Object message',
        statusCode: 400,
      }, HttpStatus.BAD_REQUEST);
      
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      
      const call = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(call.message).toBe('Object message');
    });

    it('should handle missing message gracefully', () => {
      const exception = new HttpException({
        statusCode: 400,
      }, HttpStatus.BAD_REQUEST);
      
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);
      
      const call = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(call.message).toBe('An error occurred');
    });
  });
});