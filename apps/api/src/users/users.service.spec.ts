import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { DatabaseService } from '../database/database.service';
import { PinoLogger } from 'nestjs-pino';
import { hash } from 'bcrypt';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  const mockUser = {
    id: 'user-123',
    email: 'testuser@example.com',
    password: 'hashedpassword',
    role: 'user',
    apiKey: 'gapi_test123',
    firstName: 'Test',
    lastName: 'User',
    isActive: true,
    lastLoginAt: null,
    emailVerified: false,
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDatabaseService = {
    db: {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    },
  };

  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      mockDatabaseService.db.limit.mockResolvedValue([mockUser]);

      const result = await service.findByEmail('testuser@example.com');

      expect(result).toEqual(mockUser);
      expect(mockDatabaseService.db.where).toHaveBeenCalled();
    });

    it('should return null when user not found', async () => {
      mockDatabaseService.db.limit.mockResolvedValue([]);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockDatabaseService.db.limit.mockRejectedValue(new Error('Database error'));

      await expect(service.findByEmail('testuser@example.com')).rejects.toThrow('Database error');
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      mockDatabaseService.db.limit.mockResolvedValue([mockUser]);

      const result = await service.findById('user-123');

      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockDatabaseService.db.limit.mockResolvedValue([]);

      const result = await service.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    beforeEach(() => {
      (hash as jest.Mock).mockResolvedValue('hashedpassword');
    });

    it('should create user with api-user role', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'password123',
        role: 'user' as const,
        firstName: 'New',
        lastName: 'User',
      };

      mockDatabaseService.db.returning.mockResolvedValue([mockUser]);

      const result = await service.create(userData);

      expect(result).toEqual(mockUser);
      expect(hash).toHaveBeenCalledWith('password123', 10);
    });

    it('should create admin user', async () => {
      const adminData = {
        email: 'admin@example.com',
        password: 'adminpass',
        role: 'admin' as const,
        firstName: 'Admin',
        lastName: 'User',
      };

      const adminUser = { ...mockUser, role: 'admin' };
      mockDatabaseService.db.returning.mockResolvedValue([adminUser]);

      const result = await service.create(adminData);

      expect(result).toEqual(adminUser);
      expect(result.role).toBe('admin');
    });

    it('should generate API key for api-user role', async () => {
      const userData = {
        email: 'apiuser@example.com',
        password: 'password123',
        role: 'user' as const,
        apiKey: 'gapi_custom123',
        firstName: 'API',
        lastName: 'User',
      };

      mockDatabaseService.db.returning.mockResolvedValue([mockUser]);

      const result = await service.create(userData);

      expect(result).toEqual(mockUser);
    });

    it('should handle database constraint violations', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'password123',
        role: 'user' as const,
        firstName: 'Duplicate',
        lastName: 'User',
      };

      mockDatabaseService.db.returning.mockRejectedValue(new Error('Constraint violation'));

      await expect(service.create(userData)).rejects.toThrow('Constraint violation');
    });
  });

  describe('updateApiKey', () => {
    it('should update API key successfully', async () => {
      const newApiKey = 'gapi_updated123';
      const updatedUser = { ...mockUser, apiKey: newApiKey };

      mockDatabaseService.db.returning.mockResolvedValue([updatedUser]);

      const result = await service.updateApiKey('user-123', newApiKey);

      expect(result).toEqual(updatedUser);
      expect(mockDatabaseService.db.set).toHaveBeenCalledWith(expect.objectContaining({
        apiKey: newApiKey,
        updatedAt: expect.any(Date),
      }));
    });


  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      await service.updateLastLogin('user-123');

      expect(mockDatabaseService.db.set).toHaveBeenCalledWith(expect.objectContaining({
        lastLoginAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }));
    });
  });


  describe('findByApiKey', () => {
    it('should return user when found by API key', async () => {
      mockDatabaseService.db.limit.mockResolvedValue([mockUser]);

      const result = await service.findByApiKey('gapi_test123');

      expect(result).toEqual(mockUser);
    });

    it('should return null when API key not found', async () => {
      mockDatabaseService.db.limit.mockResolvedValue([]);

      const result = await service.findByApiKey('invalid_key');

      expect(result).toBeNull();
    });

    it('should handle empty API key', async () => {
      mockDatabaseService.db.limit.mockResolvedValue([]);

      const result = await service.findByApiKey('');

      expect(result).toBeNull();
    });

    it('should handle special characters in API key', async () => {
      mockDatabaseService.db.limit.mockResolvedValue([mockUser]);

      const result = await service.findByApiKey('gapi_test@123!');

      expect(result).toEqual(mockUser);
    });

    it('should handle very long API key', async () => {
      const longApiKey = 'gapi_' + 'a'.repeat(100);
      mockDatabaseService.db.limit.mockResolvedValue([]);

      const result = await service.findByApiKey(longApiKey);

      expect(result).toBeNull();
    });

    it('should be case sensitive', async () => {
      mockDatabaseService.db.limit.mockResolvedValue([]);

      const result = await service.findByApiKey('GAPI_TEST123'); // Different case

      expect(result).toBeNull();
    });
  });
});