import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { UsersService } from "../../users/users.service";

describe("JwtAuthGuard", () => {
  let guard: JwtAuthGuard;
  let jwtService: jest.Mocked<JwtService>;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue("test-secret"),
          },
        },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    jwtService = module.get(JwtService);
    usersService = module.get(UsersService);
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  // Note: JwtAuthGuard extends PassportStrategy, so most testing
  // would be integration tests. The guard itself is a thin wrapper.
});
