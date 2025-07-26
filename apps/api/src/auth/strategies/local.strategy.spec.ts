import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { LocalStrategy } from "./local.strategy";
import { AuthService } from "../auth.service";
import { User } from "../../database/schema/users";

describe("LocalStrategy", () => {
  let strategy: LocalStrategy;
  let authService: jest.Mocked<AuthService>;

  const mockUser: User = {
    id: "user-123",
    email: "testuser@example.com",
    password: "hashedpassword",
    role: "api-user",
    apiKey: "gapi_test123",
    firstName: "Test",
    lastName: "User",
    isActive: true,
    lastLoginAt: null,
    emailVerified: false,
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRequest = {
    headers: {},
    ip: "127.0.0.1",
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        {
          provide: AuthService,
          useValue: {
            validateUser: jest.fn(),
          },
        },
      ],
    }).compile();

    strategy = module.get<LocalStrategy>(LocalStrategy);
    authService = module.get(AuthService);
  });

  it("should be defined", () => {
    expect(strategy).toBeDefined();
  });

  describe("validate", () => {
    it("should return user when credentials are valid", async () => {
      authService.validateUser.mockResolvedValue(mockUser);

      const result = await strategy.validate(
        mockRequest,
        "testuser@example.com",
        "password123",
      );

      expect(result).toEqual(mockUser);
      expect(authService.validateUser).toHaveBeenCalledWith(
        "testuser@example.com",
        "password123",
        mockRequest,
      );
    });

    it("should return admin user when admin credentials are valid", async () => {
      const adminUser = {
        ...mockUser,
        email: "admin@example.com",
        role: "admin" as const,
      };
      authService.validateUser.mockResolvedValue(adminUser);

      const result = await strategy.validate(
        mockRequest,
        "admin@example.com",
        "adminpass",
      );

      expect(result).toEqual(adminUser);
      expect(authService.validateUser).toHaveBeenCalledWith(
        "admin@example.com",
        "adminpass",
        mockRequest,
      );
    });

    it("should throw UnauthorizedException when credentials are invalid", async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(
        strategy.validate(mockRequest, "testuser@example.com", "wrongpassword"),
      ).rejects.toThrow(UnauthorizedException);

      expect(authService.validateUser).toHaveBeenCalledWith(
        "testuser@example.com",
        "wrongpassword",
        mockRequest,
      );
    });

    it("should throw UnauthorizedException when user does not exist", async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(
        strategy.validate(mockRequest, "nonexistent@example.com", "password"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException with correct message", async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(
        strategy.validate(mockRequest, "testuser@example.com", "wrongpassword"),
      ).rejects.toThrow("Invalid credentials");
    });

    it("should handle empty email", async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(
        strategy.validate(mockRequest, "", "password"),
      ).rejects.toThrow(UnauthorizedException);

      expect(authService.validateUser).toHaveBeenCalledWith(
        "",
        "password",
        mockRequest,
      );
    });

    it("should handle empty password", async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(
        strategy.validate(mockRequest, "testuser@example.com", ""),
      ).rejects.toThrow(UnauthorizedException);

      expect(authService.validateUser).toHaveBeenCalledWith(
        "testuser@example.com",
        "",
        mockRequest,
      );
    });

    it("should handle both empty email and password", async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate(mockRequest, "", "")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should handle whitespace-only credentials", async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(
        strategy.validate(mockRequest, "   ", "   "),
      ).rejects.toThrow(UnauthorizedException);

      expect(authService.validateUser).toHaveBeenCalledWith(
        "   ",
        "   ",
        mockRequest,
      );
    });

    it("should handle special characters in credentials", async () => {
      const userWithSpecialChars = { ...mockUser, email: "user@test.com" };
      authService.validateUser.mockResolvedValue(userWithSpecialChars);

      const result = await strategy.validate(
        mockRequest,
        "user@test.com",
        "p@ssw0rd!",
      );

      expect(result).toEqual(userWithSpecialChars);
      expect(authService.validateUser).toHaveBeenCalledWith(
        "user@test.com",
        "p@ssw0rd!",
        mockRequest,
      );
    });

    it("should handle very long credentials", async () => {
      const longEmail = "a".repeat(50) + "@example.com";
      const longPassword = "b".repeat(200);

      authService.validateUser.mockResolvedValue(null);

      await expect(
        strategy.validate(mockRequest, longEmail, longPassword),
      ).rejects.toThrow(UnauthorizedException);

      expect(authService.validateUser).toHaveBeenCalledWith(
        longEmail,
        longPassword,
        mockRequest,
      );
    });

    it("should handle AuthService throwing error", async () => {
      authService.validateUser.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(
        strategy.validate(mockRequest, "testuser@example.com", "password"),
      ).rejects.toThrow("Database connection failed");
    });

    it("should handle case sensitivity in email", async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(
        strategy.validate(mockRequest, "TestUser@example.com", "password"),
      ).rejects.toThrow(UnauthorizedException);

      expect(authService.validateUser).toHaveBeenCalledWith(
        "TestUser@example.com",
        "password",
        mockRequest,
      );
    });

    it("should preserve original user object structure", async () => {
      const userWithAllFields = {
        ...mockUser,
        apiKey: "gapi_test456",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
      };

      authService.validateUser.mockResolvedValue(userWithAllFields);

      const result = await strategy.validate(
        mockRequest,
        "testuser@example.com",
        "password",
      );

      expect(result).toEqual(userWithAllFields);
      expect(result).toHaveProperty("password");
      expect(result).toHaveProperty("apiKey");
      expect(result).toHaveProperty("createdAt");
      expect(result).toHaveProperty("updatedAt");
    });

    it("should handle undefined or null return from AuthService", async () => {
      authService.validateUser.mockResolvedValue(undefined as any);

      await expect(
        strategy.validate(mockRequest, "testuser@example.com", "password"),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
