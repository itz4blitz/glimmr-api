import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { FlexibleAuthGuard } from "./flexible-auth.guard";
import { AuthService } from "../auth.service";

describe("FlexibleAuthGuard", () => {
  let guard: FlexibleAuthGuard;
  let jwtService: jest.Mocked<JwtService>;
  let authService: jest.Mocked<AuthService>;

  const mockExecutionContext = (headers: Record<string, string> = {}): ExecutionContext => {
    const mockRequest = {
      headers,
      user: undefined as { id: string; username: string; role: string } | undefined,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: jest.fn(),
        getNext: jest.fn(),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlexibleAuthGuard,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue("test-secret"),
          },
        },
        {
          provide: AuthService,
          useValue: {
            validateApiKey: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<FlexibleAuthGuard>(FlexibleAuthGuard);
    jwtService = module.get(JwtService);
    authService = module.get(AuthService);
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  describe("canActivate", () => {
    it("should authenticate with valid JWT token", async () => {
      const mockPayload = {
        sub: "user-123",
        username: "testuser",
        role: "admin",
      };

      jwtService.verify.mockReturnValue(mockPayload);

      const headers = {
        authorization: "Bearer valid.jwt.token",
      };
      const context = mockExecutionContext(headers);
      const request = context.switchToHttp().getRequest();

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.user).toEqual({
        id: "user-123",
        username: "testuser",
        role: "admin",
      });
      expect(jwtService.verify).toHaveBeenCalledWith("valid.jwt.token", {
        secret: "test-secret",
      });
    });

    it("should authenticate with valid API key when JWT fails", async () => {
      const mockUser = {
        id: "user-456",
        username: "apiuser",
        role: "api-user",
      };

      jwtService.verify.mockImplementation(() => {
        throw new Error("JWT verification failed");
      });
      authService.validateApiKey.mockResolvedValue(mockUser);

      const headers = {
        authorization: "Bearer invalid.jwt.token",
        "x-api-key": "gapi_valid123",
      };
      const context = mockExecutionContext(headers);
      const request = context.switchToHttp().getRequest();

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.user).toEqual(mockUser);
      expect(authService.validateApiKey).toHaveBeenCalledWith("gapi_valid123");
    });

    it("should authenticate with API key when no JWT provided", async () => {
      const mockUser = {
        id: "user-789",
        username: "keyuser",
        role: "api-user",
      };

      authService.validateApiKey.mockResolvedValue(mockUser);

      const headers = {
        "x-api-key": "gapi_valid456",
      };
      const context = mockExecutionContext(headers);
      const request = context.switchToHttp().getRequest();

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request.user).toEqual(mockUser);
      expect(authService.validateApiKey).toHaveBeenCalledWith("gapi_valid456");
    });

    it("should throw UnauthorizedException when no authentication provided", async () => {
      const headers = {};
      const context = mockExecutionContext(headers);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException when JWT is invalid and no API key", async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error("JWT verification failed");
      });

      const headers = {
        authorization: "Bearer invalid.jwt.token",
      };
      const context = mockExecutionContext(headers);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException when API key is invalid", async () => {
      authService.validateApiKey.mockResolvedValue(null);

      const headers = {
        "x-api-key": "invalid_key",
      };
      const context = mockExecutionContext(headers);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException when both JWT and API key are invalid", async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error("JWT verification failed");
      });
      authService.validateApiKey.mockResolvedValue(null);

      const headers = {
        authorization: "Bearer invalid.jwt.token",
        "x-api-key": "invalid_key",
      };
      const context = mockExecutionContext(headers);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should handle malformed authorization header", async () => {
      const headers = {
        authorization: "NotBearer token",
      };
      const context = mockExecutionContext(headers);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should handle authorization header without token", async () => {
      const headers = {
        authorization: "Bearer",
      };
      const context = mockExecutionContext(headers);

      // This should try to verify an empty string and fail
      jwtService.verify.mockImplementation(() => {
        throw new Error("JWT verification failed");
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should handle API key validation throwing error", async () => {
      authService.validateApiKey.mockRejectedValue(new Error("Database error"));

      const headers = {
        "x-api-key": "gapi_test123",
      };
      const context = mockExecutionContext(headers);

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
