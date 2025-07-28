import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtStrategy } from "./jwt.strategy";
import { UsersService } from "../../users/users.service";
import { User } from "../../database/schema/users";

describe("JwtStrategy", () => {
  let strategy: JwtStrategy;
  let usersService: jest.Mocked<UsersService>;
  let configService: jest.Mocked<ConfigService>;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue("test-secret"),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    usersService = module.get(UsersService);
    configService = module.get(ConfigService);
  });

  it("should be defined", () => {
    expect(strategy).toBeDefined();
  });

  describe("validate", () => {
    it("should return user object when user exists", async () => {
      const payload = {
        sub: "user-123",
        email: "testuser@example.com",
        role: "api-user",
      };

      usersService.findById.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(usersService.findById).toHaveBeenCalledWith("user-123");
    });

    it("should return user object for admin user", async () => {
      const adminUser = { ...mockUser, role: "admin" as const };
      const payload = {
        sub: "admin-123",
        email: "admin@example.com",
        role: "admin",
      };

      usersService.findById.mockResolvedValue(adminUser);

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
      });
    });

    it("should handle user not found", async () => {
      const payload = {
        sub: "nonexistent-123",
        email: "nonexistent@example.com",
        role: "api-user",
      };

      usersService.findById.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow();
    });

    it("should handle database errors", async () => {
      const payload = {
        sub: "user-123",
        email: "testuser@example.com",
        role: "api-user",
      };

      usersService.findById.mockRejectedValue(new Error("Database error"));

      await expect(strategy.validate(payload)).rejects.toThrow(
        "Database error",
      );
    });

    it("should extract user ID from sub field", async () => {
      const payload = {
        sub: "different-id-456",
        email: "testuser@example.com",
        role: "api-user",
      };

      usersService.findById.mockResolvedValue(mockUser);

      await strategy.validate(payload);

      expect(usersService.findById).toHaveBeenCalledWith("different-id-456");
    });

    it("should handle payload with additional fields", async () => {
      const payload = {
        sub: "user-123",
        email: "testuser@example.com",
        role: "api-user",
        iat: 1234567890,
        exp: 1234567890,
        extraField: "should be ignored",
      };

      usersService.findById.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
    });

    it("should not include sensitive fields in response", async () => {
      const payload = {
        sub: "user-123",
        email: "testuser@example.com",
        role: "api-user",
      };

      usersService.findById.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).not.toHaveProperty("password");
      expect(result).not.toHaveProperty("apiKey");
      expect(result).not.toHaveProperty("createdAt");
      expect(result).not.toHaveProperty("updatedAt");
    });

    it("should handle empty payload sub field", async () => {
      const payload = {
        sub: "",
        email: "testuser@example.com",
        role: "api-user",
      };

      usersService.findById.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow();
      expect(usersService.findById).toHaveBeenCalledWith("");
    });

    it("should handle undefined payload sub field", async () => {
      const payload = {
        sub: undefined!,
        email: "testuser@example.com",
        role: "api-user",
      };

      usersService.findById.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow();
      expect(usersService.findById).toHaveBeenCalledWith(undefined);
    });
  });

  describe("constructor", () => {
    it("should be configured with correct JWT options", () => {
      expect(configService.get).toHaveBeenCalledWith("JWT_SECRET");

      // Verify that the strategy is configured with the expected options
      // Note: These are internal to PassportStrategy, so we mainly test that
      // the configService.get was called with the right parameter
    });
  });
});
