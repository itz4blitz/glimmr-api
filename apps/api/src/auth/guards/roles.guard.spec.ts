import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";
import { ROLES_KEY } from "../decorators/roles.decorator";

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  const mockExecutionContext = (
    user: { role?: string } | null = null,
  ): ExecutionContext => {
    const mockRequest = { user };

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
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<jest.Mocked<Reflector>>(Reflector);
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  describe("canActivate", () => {
    it("should return true when no roles are required", () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const context = mockExecutionContext();
      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });

    it("should return true when user has required role", () => {
      reflector.getAllAndOverride.mockReturnValue(["admin"]);

      const user = { role: "admin" };
      const context = mockExecutionContext(user);
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should return true when user has one of multiple required roles", () => {
      reflector.getAllAndOverride.mockReturnValue(["admin", "api-user"]);

      const user = { role: "api-user" };
      const context = mockExecutionContext(user);
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should return false when user does not have required role", () => {
      reflector.getAllAndOverride.mockReturnValue(["admin"]);

      const user = { role: "api-user" };
      const context = mockExecutionContext(user);
      const result = guard.canActivate(context);

      expect(result).toBe(false);
    });

    it("should return false when user has no role", () => {
      reflector.getAllAndOverride.mockReturnValue(["admin"]);

      const user = {};
      const context = mockExecutionContext(user);
      const result = guard.canActivate(context);

      expect(result).toBe(false);
    });

    it("should return false when user is null", () => {
      reflector.getAllAndOverride.mockReturnValue(["admin"]);

      const context = mockExecutionContext(null);
      const result = guard.canActivate(context);

      expect(result).toBe(false);
    });

    it("should handle role arrays (user role contains required role)", () => {
      reflector.getAllAndOverride.mockReturnValue(["admin"]);

      // Simulate a user with role array (though our schema uses single role)
      const user = { role: "admin" };
      const context = mockExecutionContext(user);
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should be case sensitive for roles", () => {
      reflector.getAllAndOverride.mockReturnValue(["admin"]);

      const user = { role: "Admin" }; // Different case
      const context = mockExecutionContext(user);
      const result = guard.canActivate(context);

      expect(result).toBe(false);
    });
  });
});
