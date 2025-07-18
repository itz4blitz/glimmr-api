import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { LocalStrategy } from './local.strategy';
import { AuthService } from '../auth.service';
import { User } from '../../database/schema/users';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let authService: jest.Mocked<AuthService>;

  const mockUser: User = {
    id: 'user-123',
    username: 'testuser',
    password: 'hashedpassword',
    role: 'api-user',
    apiKey: 'gapi_test123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

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

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user when credentials are valid', async () => {
      authService.validateUser.mockResolvedValue(mockUser);

      const result = await strategy.validate('testuser', 'password123');

      expect(result).toEqual(mockUser);
      expect(authService.validateUser).toHaveBeenCalledWith('testuser', 'password123');
    });

    it('should return admin user when admin credentials are valid', async () => {
      const adminUser = { ...mockUser, username: 'admin', role: 'admin' as const };
      authService.validateUser.mockResolvedValue(adminUser);

      const result = await strategy.validate('admin', 'adminpass');

      expect(result).toEqual(adminUser);
      expect(authService.validateUser).toHaveBeenCalledWith('admin', 'adminpass');
    });

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('testuser', 'wrongpassword'))
        .rejects.toThrow(UnauthorizedException);
      
      expect(authService.validateUser).toHaveBeenCalledWith('testuser', 'wrongpassword');
    });

    it('should throw UnauthorizedException when user does not exist', async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('nonexistent', 'password'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException with correct message', async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('testuser', 'wrongpassword'))
        .rejects.toThrow('Invalid credentials');
    });

    it('should handle empty username', async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('', 'password'))
        .rejects.toThrow(UnauthorizedException);
      
      expect(authService.validateUser).toHaveBeenCalledWith('', 'password');
    });

    it('should handle empty password', async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('testuser', ''))
        .rejects.toThrow(UnauthorizedException);
      
      expect(authService.validateUser).toHaveBeenCalledWith('testuser', '');
    });

    it('should handle both empty username and password', async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('', ''))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should handle whitespace-only credentials', async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('   ', '   '))
        .rejects.toThrow(UnauthorizedException);
      
      expect(authService.validateUser).toHaveBeenCalledWith('   ', '   ');
    });

    it('should handle special characters in credentials', async () => {
      const userWithSpecialChars = { ...mockUser, username: 'user@test.com' };
      authService.validateUser.mockResolvedValue(userWithSpecialChars);

      const result = await strategy.validate('user@test.com', 'p@ssw0rd!');

      expect(result).toEqual(userWithSpecialChars);
      expect(authService.validateUser).toHaveBeenCalledWith('user@test.com', 'p@ssw0rd!');
    });

    it('should handle very long credentials', async () => {
      const longUsername = 'a'.repeat(100);
      const longPassword = 'b'.repeat(200);
      
      authService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate(longUsername, longPassword))
        .rejects.toThrow(UnauthorizedException);
      
      expect(authService.validateUser).toHaveBeenCalledWith(longUsername, longPassword);
    });

    it('should handle AuthService throwing error', async () => {
      authService.validateUser.mockRejectedValue(new Error('Database connection failed'));

      await expect(strategy.validate('testuser', 'password'))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle case sensitivity in username', async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('TestUser', 'password'))
        .rejects.toThrow(UnauthorizedException);
      
      expect(authService.validateUser).toHaveBeenCalledWith('TestUser', 'password');
    });

    it('should preserve original user object structure', async () => {
      const userWithAllFields = {
        ...mockUser,
        apiKey: 'gapi_test456',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };
      
      authService.validateUser.mockResolvedValue(userWithAllFields);

      const result = await strategy.validate('testuser', 'password');

      expect(result).toEqual(userWithAllFields);
      expect(result).toHaveProperty('password');
      expect(result).toHaveProperty('apiKey');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });

    it('should handle undefined or null return from AuthService', async () => {
      authService.validateUser.mockResolvedValue(undefined as any);

      await expect(strategy.validate('testuser', 'password'))
        .rejects.toThrow(UnauthorizedException);
    });
  });
});