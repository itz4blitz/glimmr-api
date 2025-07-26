import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { FlexibleAuthGuard } from "./flexible-auth.guard";
import { AuthService } from "../auth.service";

describe("FlexibleAuthGuard", () => {
  let guard: FlexibleAuthGuard;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let authService: jest.Mocked<AuthService>;

  const mockExecutionContext = (headers: any = {}): ExecutionContext => {
    const mockRequest = {
      headers,
      user: undefined, // Will be set by guard
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest as any,
        getResponse: jest.fn() as any,
        getNext: jest.fn() as any,
      }),
      getHandler: jest.fn() as any,
      getClass: jest.fn() as any,
      getArgs: jest.fn() as any,
      getArgByIndex: jest.fn() as any,
      switchToRpc: jest.fn() as any,
      switchToWs: jest.fn() as any,
      getType: jest.fn() as any,
    };
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
    configService = module.get(ConfigService);
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
      authService.validateApiKey.mockResolvedValue(mockUser as any);

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

      authService.validateApiKey.mockResolvedValue(mockUser as any);

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
