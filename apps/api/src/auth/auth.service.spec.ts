import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { User } from '../database/schema/users';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser: User = {
    id: 'user-id-123',
    username: 'testuser',
    password: 'hashedpassword',
    role: 'api-user',
    apiKey: 'gapi_test123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAdminUser: User = {
    id: 'admin-id-123',
    username: 'admin',
    password: 'hashedpassword',
    role: 'admin',
    apiKey: 'gapi_admin123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByUsername: jest.fn(),
            findByApiKey: jest.fn(),
            create: jest.fn(),
            updateApiKey: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
      const plainPassword = 'testpassword';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      const userWithHashedPassword = { ...mockUser, password: hashedPassword };

      usersService.findByUsername.mockResolvedValue(userWithHashedPassword);

      const result = await service.validateUser('testuser', plainPassword);

      expect(result).toEqual(userWithHashedPassword);
      expect(usersService.findByUsername).toHaveBeenCalledWith('testuser');
    });

    it('should return null when user does not exist', async () => {
      usersService.findByUsername.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent', 'password');

      expect(result).toBeNull();
    });

    it('should return null when password is incorrect', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      const userWithHashedPassword = { ...mockUser, password: hashedPassword };

      usersService.findByUsername.mockResolvedValue(userWithHashedPassword);

      const result = await service.validateUser('testuser', 'wrongpassword');

      expect(result).toBeNull();
    });
  });

  describe('validateApiKey', () => {
    it('should return user when API key is valid', async () => {
      const apiKey = 'gapi_valid123';
      const userWithApiKey = { ...mockUser, apiKey };

      usersService.findByApiKey.mockResolvedValue(userWithApiKey);

      const result = await service.validateApiKey(apiKey);

      expect(result).toEqual(userWithApiKey);
      expect(usersService.findByApiKey).toHaveBeenCalledWith(apiKey);
    });

    it('should return null when API key is invalid', async () => {
      usersService.findByApiKey.mockResolvedValue(null);

      const result = await service.validateApiKey('invalid_key');

      expect(result).toBeNull();
    });

    it('should return null when user exists but API key does not match', async () => {
      const userWithDifferentApiKey = { ...mockUser, apiKey: 'different_key' };
      usersService.findByApiKey.mockResolvedValue(userWithDifferentApiKey);

      const result = await service.validateApiKey('gapi_test123');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access token and user info for valid user', async () => {
      const expectedToken = 'jwt.token.here';
      jwtService.sign.mockReturnValue(expectedToken);

      const result = await service.login(mockUser);

      expect(result).toEqual({
        access_token: expectedToken,
        user: {
          id: mockUser.id,
          username: mockUser.username,
          role: mockUser.role,
        },
      });

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        username: mockUser.username,
        role: mockUser.role,
      });
    });

    it('should work for admin users', async () => {
      const expectedToken = 'admin.jwt.token';
      jwtService.sign.mockReturnValue(expectedToken);

      const result = await service.login(mockAdminUser);

      expect(result.user.role).toBe('admin');
      expect(result.access_token).toBe(expectedToken);
    });
  });

  describe('register', () => {
    it('should create new user and return login response', async () => {
      const plainPassword = 'newpassword';
      const username = 'newuser';
      const role = 'api-user';

      usersService.findByUsername.mockResolvedValue(null); // User doesn't exist
      usersService.create.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('new.jwt.token');

      // Mock bcrypt.hash
      jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve('hashedpassword'));

      const result = await service.register(username, plainPassword, role);

      expect(result).toEqual({
        access_token: 'new.jwt.token',
        user: {
          id: mockUser.id,
          username: mockUser.username,
          role: mockUser.role,
        },
      });

      expect(usersService.findByUsername).toHaveBeenCalledWith(username);
      expect(usersService.create).toHaveBeenCalledWith({
        username,
        password: 'hashedpassword',
        role,
      });
    });

    it('should throw error when username already exists', async () => {
      usersService.findByUsername.mockResolvedValue(mockUser);

      await expect(
        service.register('testuser', 'password', 'api-user')
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should default to api-user role when no role specified', async () => {
      usersService.findByUsername.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('jwt.token');

      jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve('hashedpassword'));

      await service.register('newuser', 'password');

      expect(usersService.create).toHaveBeenCalledWith({
        username: 'newuser',
        password: 'hashedpassword',
        role: 'api-user',
      });
    });

    it('should allow creating admin users', async () => {
      usersService.findByUsername.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockAdminUser);
      jwtService.sign.mockReturnValue('admin.jwt.token');

      jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve('hashedpassword'));

      const result = await service.register('admin', 'password', 'admin');

      expect(usersService.create).toHaveBeenCalledWith({
        username: 'admin',
        password: 'hashedpassword',
        role: 'admin',
      });
    });
  });

  describe('generateApiKey', () => {
    it('should generate and update API key for user', async () => {
      const userId = 'user-123';
      const expectedApiKey = 'gapi_generated123';
      
      // Mock the random generation to return predictable result
      jest.spyOn(Math, 'random')
        .mockReturnValueOnce(0.123456789)
        .mockReturnValueOnce(0.987654321);

      usersService.updateApiKey.mockResolvedValue({
        ...mockUser,
        apiKey: expectedApiKey,
      });

      const result = await service.generateApiKey(userId);

      expect(result).toMatch(/^gapi_[a-z0-9]+$/);
      expect(usersService.updateApiKey).toHaveBeenCalledWith(
        userId,
        expect.stringMatching(/^gapi_[a-z0-9]+$/)
      );
    });

    it('should generate unique API keys', async () => {
      usersService.updateApiKey.mockResolvedValue(mockUser);

      const key1 = await service.generateApiKey('user1');
      const key2 = await service.generateApiKey('user2');

      expect(key1).not.toBe(key2);
      expect(key1).toMatch(/^gapi_[a-z0-9]+$/);
      expect(key2).toMatch(/^gapi_[a-z0-9]+$/);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});