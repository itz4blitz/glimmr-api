import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Request, Response, NextFunction } from "express";
import { BullBoardAuthMiddleware } from "./bull-board-auth.middleware";
import { AuthService } from "../auth.service";

describe("BullBoardAuthMiddleware", () => {
  let middleware: BullBoardAuthMiddleware;
  let jwtService: jest.Mocked<JwtService>;
  let _configService: jest.Mocked<ConfigService>;
  let authService: jest.Mocked<AuthService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BullBoardAuthMiddleware,
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

    middleware = module.get<BullBoardAuthMiddleware>(BullBoardAuthMiddleware);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    authService = module.get(AuthService);

    mockRequest = {
      headers: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe("use", () => {
    it("should allow access for admin user with valid JWT", async () => {
      const mockPayload = {
        sub: "admin-123",
        username: "admin",
        role: "admin",
      };

      mockRequest.headers = {
        authorization: "Bearer valid.jwt.token",
      };

      jwtService.verify.mockReturnValue(mockPayload);

      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should allow access for admin user with valid API key", async () => {
      const mockUser = {
        id: "admin-456",
        username: "admin",
        role: "admin",
      };

      mockRequest.headers = {
        "x-api-key": "gapi_admin123",
      };

      authService.validateApiKey.mockResolvedValue(mockUser as any);

      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should deny access for non-admin user with valid JWT", async () => {
      const mockPayload = {
        sub: "user-123",
        username: "user",
        role: "api-user",
      };

      mockRequest.headers = {
        authorization: "Bearer valid.jwt.token",
      };

      jwtService.verify.mockReturnValue(mockPayload);

      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 401,
        message: "Admin access required for queue management",
        error: "Unauthorized",
      });
    });

    it("should deny access for non-admin user with valid API key", async () => {
      const mockUser = {
        id: "user-456",
        username: "user",
        role: "api-user",
      };

      mockRequest.headers = {
        "x-api-key": "gapi_user123",
      };

      authService.validateApiKey.mockResolvedValue(mockUser as any);

      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 401,
        message: "Admin access required for queue management",
        error: "Unauthorized",
      });
    });

    it("should deny access when no authentication provided", async () => {
      mockRequest.headers = {};

      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 401,
        message: "Admin access required for queue management",
        error: "Unauthorized",
      });
    });

    it("should deny access when JWT verification fails", async () => {
      mockRequest.headers = {
        authorization: "Bearer invalid.jwt.token",
      };

      jwtService.verify.mockImplementation(() => {
        throw new Error("JWT verification failed");
      });

      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 401,
        message: "Invalid credentials",
        error: "Unauthorized",
      });
    });

    it("should deny access when API key validation fails", async () => {
      mockRequest.headers = {
        "x-api-key": "invalid_key",
      };

      authService.validateApiKey.mockResolvedValue(null);

      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 401,
        message: "Admin access required for queue management",
        error: "Unauthorized",
      });
    });

    it("should handle malformed authorization header", async () => {
      mockRequest.headers = {
        authorization: "NotBearer token",
      };

      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it("should handle authorization header without Bearer prefix", async () => {
      mockRequest.headers = {
        authorization: "token",
      };

      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it("should handle empty authorization header", async () => {
      mockRequest.headers = {
        authorization: "",
      };

      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it("should handle authorization header array (first value)", async () => {
      const mockPayload = {
        sub: "admin-123",
        username: "admin",
        role: "admin",
      };

      mockRequest.headers = {
        authorization: [
          "Bearer valid.jwt.token",
          "Bearer another.token",
        ] as any,
      };

      jwtService.verify.mockReturnValue(mockPayload);

      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it("should handle x-api-key header array (first value)", async () => {
      const mockUser = {
        id: "admin-456",
        username: "admin",
        role: "admin",
      };

      mockRequest.headers = {
        "x-api-key": ["gapi_admin123", "gapi_another"] as any,
      };

      authService.validateApiKey.mockResolvedValue(mockUser as any);

      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it("should handle user with no role", async () => {
      const mockPayload = {
        sub: "user-123",
        username: "user",
        // no role property
      };

      mockRequest.headers = {
        authorization: "Bearer valid.jwt.token",
      };

      jwtService.verify.mockReturnValue(mockPayload);

      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it("should handle user with null role", async () => {
      const mockPayload = {
        sub: "user-123",
        username: "user",
        role: null,
      };

      mockRequest.headers = {
        authorization: "Bearer valid.jwt.token",
      };

      jwtService.verify.mockReturnValue(mockPayload);

      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it("should handle API key validation throwing error", async () => {
      mockRequest.headers = {
        "x-api-key": "gapi_test123",
      };

      authService.validateApiKey.mockRejectedValue(new Error("Database error"));

      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 401,
        message: "Invalid credentials",
        error: "Unauthorized",
      });
    });

    it("should prioritize JWT over API key when both are provided", async () => {
      const mockPayload = {
        sub: "admin-123",
        username: "admin",
        role: "admin",
      };

      mockRequest.headers = {
        authorization: "Bearer valid.jwt.token",
        "x-api-key": "gapi_admin123",
      };

      jwtService.verify.mockReturnValue(mockPayload);

      await middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
      expect(authService.validateApiKey).not.toHaveBeenCalled();
    });
  });
});
