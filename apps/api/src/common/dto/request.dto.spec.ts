import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RequestDto, ResponseDto } from './request.dto';

describe('Request/Response DTOs', () => {
  describe('RequestDto', () => {
    it('should validate with all valid data', async () => {
      const dto = plainToInstance(RequestDto, {
        url: 'https://example.com/api',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token123',
        },
        method: 'GET',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with minimal data', async () => {
      const dto = plainToInstance(RequestDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with only url', async () => {
      const dto = plainToInstance(RequestDto, {
        url: 'https://api.example.com',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with only headers', async () => {
      const dto = plainToInstance(RequestDto, {
        headers: {
          'User-Agent': 'NestJS App',
        },
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with only method', async () => {
      const dto = plainToInstance(RequestDto, {
        method: 'POST',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with empty headers object', async () => {
      const dto = plainToInstance(RequestDto, {
        headers: {},
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with non-string method', async () => {
      const dto = plainToInstance(RequestDto, {
        method: 123,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should validate with various HTTP methods', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
      
      for (const method of methods) {
        const dto = plainToInstance(RequestDto, { method });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    it('should validate with complex headers object', async () => {
      const dto = plainToInstance(RequestDto, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Custom-Header': 'custom-value',
          'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9',
        },
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with various URL formats', async () => {
      const urls = [
        'https://example.com',
        'http://localhost:3000',
        'https://api.example.com/v1/users',
        'https://example.com/path?query=value',
        'https://example.com/path#fragment',
      ];
      
      for (const url of urls) {
        const dto = plainToInstance(RequestDto, { url });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });
  });

  describe('ResponseDto', () => {
    it('should validate with all valid data', async () => {
      const dto = plainToInstance(ResponseDto, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        json: jest.fn(),
        send: jest.fn(),
        setHeader: jest.fn(),
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with minimal data', async () => {
      const dto = plainToInstance(ResponseDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with only status', async () => {
      const dto = plainToInstance(ResponseDto, {
        status: 404,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with only headers', async () => {
      const dto = plainToInstance(ResponseDto, {
        headers: {
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '99',
        },
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with only functions', async () => {
      const dto = plainToInstance(ResponseDto, {
        json: jest.fn(),
        send: jest.fn(),
        setHeader: jest.fn(),
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with various HTTP status codes', async () => {
      const statusCodes = [200, 201, 400, 401, 403, 404, 500, 502, 503];
      
      for (const status of statusCodes) {
        const dto = plainToInstance(ResponseDto, { status });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });

    it('should validate with empty headers object', async () => {
      const dto = plainToInstance(ResponseDto, {
        headers: {},
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with complex headers object', async () => {
      const dto = plainToInstance(ResponseDto, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': '1024',
          'Set-Cookie': 'session=abc123; HttpOnly; Secure',
          'X-Powered-By': 'NestJS',
          'Access-Control-Allow-Origin': '*',
        },
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate function properties as optional', async () => {
      // Test that functions are optional and can be undefined
      const dto = plainToInstance(ResponseDto, {
        status: 200,
        json: undefined,
        send: undefined,
        setHeader: undefined,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should validate with mock functions', async () => {
      const mockJson = jest.fn().mockReturnValue('json response');
      const mockSend = jest.fn().mockReturnValue('send response');
      const mockSetHeader = jest.fn();

      const dto = plainToInstance(ResponseDto, {
        json: mockJson,
        send: mockSend,
        setHeader: mockSetHeader,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      
      // Verify functions work
      expect(dto.json).toBe(mockJson);
      expect(dto.send).toBe(mockSend);
      expect(dto.setHeader).toBe(mockSetHeader);
    });
  });
});