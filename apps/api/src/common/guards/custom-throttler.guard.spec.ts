import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CustomThrottlerGuard } from './custom-throttler.guard';

describe('CustomThrottlerGuard', () => {
  let guard: CustomThrottlerGuard;
  let reflector: Reflector;
  let mockExecutionContext: ExecutionContext;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          {
            name: 'default',
            ttl: 60000,
            limit: 10,
          },
          {
            name: 'expensive',
            ttl: 900000,
            limit: 5,
          },
        ]),
      ],
      providers: [CustomThrottlerGuard, Reflector],
    }).compile();

    guard = module.get<CustomThrottlerGuard>(CustomThrottlerGuard);
    reflector = module.get<Reflector>(Reflector);

    // Mock request object
    mockRequest = {
      ip: '127.0.0.1',
      method: 'GET',
      path: '/test',
      route: { path: '/test' },
      headers: {},
      connection: { remoteAddress: '127.0.0.1' },
      user: null,
    };

    // Mock response object with setHeader spy
    mockResponse = {
      setHeader: jest.fn(),
    };

    // Mock ExecutionContext
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Guard Initialization', () => {
    it('should be defined', () => {
      expect(guard).toBeDefined();
      expect(guard).toBeInstanceOf(ThrottlerGuard);
    });

    it('should have reflector injected', () => {
      expect(reflector).toBeDefined();
    });
  });

  describe('generateKey method', () => {
    it('should generate unique key for anonymous user with IP', () => {
      const suffix = 'test-suffix';
      const name = 'default';
      
      const key = guard['generateKey'](mockExecutionContext, suffix, name);
      
      expect(key).toBe('throttle:default:GET:/test:ip:127.0.0.1:test-suffix');
    });

    it('should generate unique key for authenticated user', () => {
      mockRequest.user = { id: 'user123' };
      const suffix = 'test-suffix';
      const name = 'expensive';
      
      const key = guard['generateKey'](mockExecutionContext, suffix, name);
      
      expect(key).toBe('throttle:expensive:GET:/test:user:user123:test-suffix');
    });

    it('should handle missing route path', () => {
      mockRequest.route = null;
      mockRequest.path = '/fallback';
      const suffix = 'test-suffix';
      const name = 'default';
      
      const key = guard['generateKey'](mockExecutionContext, suffix, name);
      
      expect(key).toBe('throttle:default:GET:/fallback:ip:127.0.0.1:test-suffix');
    });

    it('should handle different HTTP methods', () => {
      mockRequest.method = 'POST';
      const suffix = 'test-suffix';
      const name = 'default';
      
      const key = guard['generateKey'](mockExecutionContext, suffix, name);
      
      expect(key).toBe('throttle:default:POST:/test:ip:127.0.0.1:test-suffix');
    });
  });

  describe('getClientId method', () => {
    it('should return IP-based identifier for anonymous users', () => {
      const clientId = guard['getClientId'](mockRequest);
      expect(clientId).toBe('ip:127.0.0.1');
    });

    it('should return user-based identifier for authenticated users', () => {
      mockRequest.user = { id: 'user123' };
      
      const clientId = guard['getClientId'](mockRequest);
      expect(clientId).toBe('user:user123');
    });

    it('should handle X-Forwarded-For header', () => {
      mockRequest.headers['x-forwarded-for'] = '192.168.1.1, 10.0.0.1';
      
      const clientId = guard['getClientId'](mockRequest);
      expect(clientId).toBe('ip:192.168.1.1');
    });

    it('should handle X-Forwarded-For header with single IP', () => {
      mockRequest.headers['x-forwarded-for'] = '203.0.113.195';
      
      const clientId = guard['getClientId'](mockRequest);
      expect(clientId).toBe('ip:203.0.113.195');
    });

    it('should trim spaces from forwarded IP', () => {
      mockRequest.headers['x-forwarded-for'] = '  192.168.1.1  ';
      
      const clientId = guard['getClientId'](mockRequest);
      expect(clientId).toBe('ip:192.168.1.1');
    });

    it('should fallback to connection.remoteAddress when no forwarded header', () => {
      delete mockRequest.headers['x-forwarded-for'];
      mockRequest.connection.remoteAddress = '10.0.0.1';
      
      const clientId = guard['getClientId'](mockRequest);
      expect(clientId).toBe('ip:10.0.0.1');
    });

    it('should handle undefined user object', () => {
      mockRequest.user = undefined;
      
      const clientId = guard['getClientId'](mockRequest);
      expect(clientId).toBe('ip:127.0.0.1');
    });

    it('should handle user object without id', () => {
      mockRequest.user = { name: 'John Doe' };
      
      const clientId = guard['getClientId'](mockRequest);
      expect(clientId).toBe('ip:127.0.0.1');
    });
  });

  describe('canActivate method', () => {
    beforeEach(() => {
      // Mock the parent canActivate method
      jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
    });

    it('should call parent canActivate and return true when allowed', async () => {
      const result = await guard.canActivate(mockExecutionContext);
      
      expect(result).toBe(true);
      expect(ThrottlerGuard.prototype.canActivate).toHaveBeenCalledWith(mockExecutionContext);
    });

    it('should add rate limit headers to response', async () => {
      await guard.canActivate(mockExecutionContext);
      
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '100');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Window', '900000');
    });

    it('should return false when parent canActivate returns false', async () => {
      jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(false);
      
      const result = await guard.canActivate(mockExecutionContext);
      
      expect(result).toBe(false);
      expect(mockResponse.setHeader).toHaveBeenCalled();
    });

    it('should handle errors from parent canActivate', async () => {
      const error = new Error('Rate limit exceeded');
      jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockRejectedValue(error);
      
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Integration with ThrottlerModule', () => {
    it('should inherit throttler storage service from parent', () => {
      expect(guard['storageService']).toBeDefined();
    });

    it('should inherit reflector from parent', () => {
      expect(guard['reflector']).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed execution context', async () => {
      const malformedContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(null),
          getResponse: jest.fn().mockReturnValue(mockResponse),
        }),
      } as any;

      // Should not throw, but may have undefined behavior
      // The parent guard should handle this gracefully
      jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
      
      await expect(guard.canActivate(malformedContext)).resolves.toBe(true);
    });

    it('should handle request without headers object', () => {
      const requestWithoutHeaders = {
        ...mockRequest,
        headers: undefined,
      };
      
      const clientId = guard['getClientId'](requestWithoutHeaders);
      expect(clientId).toBe('ip:127.0.0.1');
    });

    it('should handle request without connection object', () => {
      const requestWithoutConnection = {
        ...mockRequest,
        connection: undefined,
      };
      
      const clientId = guard['getClientId'](requestWithoutConnection);
      expect(clientId).toBe('ip:undefined');
    });
  });

  describe('Key Generation Edge Cases', () => {
    it('should handle special characters in route path', () => {
      mockRequest.route = { path: '/api/v1/test-endpoint/:id' };
      const suffix = 'suffix';
      const name = 'default';
      
      const key = guard['generateKey'](mockExecutionContext, suffix, name);
      
      expect(key).toBe('throttle:default:GET:/api/v1/test-endpoint/:id:ip:127.0.0.1:suffix');
    });

    it('should handle empty suffix', () => {
      const suffix = '';
      const name = 'default';
      
      const key = guard['generateKey'](mockExecutionContext, suffix, name);
      
      expect(key).toBe('throttle:default:GET:/test:ip:127.0.0.1:');
    });

    it('should handle very long user IDs', () => {
      const longUserId = 'a'.repeat(1000);
      mockRequest.user = { id: longUserId };
      
      const clientId = guard['getClientId'](mockRequest);
      expect(clientId).toBe(`user:${longUserId}`);
    });
  });
});