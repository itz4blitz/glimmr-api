import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { DatabaseService } from '../database/database.service';
import { User } from '../database/schema/users';

describe('UsersService', () => {
  let service: UsersService;
  let mockDb: any;

  const mockUser: User = {
    id: 'user-123',
    username: 'testuser',
    password: 'hashedpassword',
    role: 'api-user',
    apiKey: 'gapi_test123',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: DatabaseService,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByUsername', () => {
    it('should return user when found', async () => {
      mockDb.limit.mockResolvedValue([mockUser]);

      const result = await service.findByUsername('testuser');

      expect(result).toEqual(mockUser);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(1);
    });

    it('should return null when user not found', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await service.findByUsername('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockDb.limit.mockRejectedValue(new Error('Database error'));

      await expect(service.findByUsername('testuser')).rejects.toThrow('Database error');
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      mockDb.limit.mockResolvedValue([mockUser]);

      const result = await service.findById('user-123');

      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await service.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByApiKey', () => {
    it('should return user when API key found', async () => {
      mockDb.limit.mockResolvedValue([mockUser]);

      const result = await service.findByApiKey('gapi_test123');

      expect(result).toEqual(mockUser);
    });

    it('should return null when API key not found', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await service.findByApiKey('invalid_key');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create and return new user', async () => {
      const userData = {
        username: 'newuser',
        password: 'hashedpassword',
        role: 'api-user' as const,
      };
      
      mockDb.returning.mockResolvedValue([mockUser]);

      const result = await service.create(userData);

      expect(result).toEqual(mockUser);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(userData);
      expect(mockDb.returning).toHaveBeenCalled();
    });

    it('should create admin user', async () => {
      const adminData = {
        username: 'admin',
        password: 'hashedpassword',
        role: 'admin' as const,
      };

      const adminUser = { ...mockUser, username: 'admin', role: 'admin' as const };
      mockDb.returning.mockResolvedValue([adminUser]);

      const result = await service.create(adminData);

      expect(result.role).toBe('admin');
      expect(mockDb.values).toHaveBeenCalledWith(adminData);
    });

    it('should create user with API key', async () => {
      const userData = {
        username: 'newuser',
        password: 'hashedpassword',
        role: 'api-user' as const,
        apiKey: 'gapi_custom123',
      };
      
      mockDb.returning.mockResolvedValue([{ ...mockUser, apiKey: 'gapi_custom123' }]);

      const result = await service.create(userData);

      expect(result.apiKey).toBe('gapi_custom123');
    });

    it('should handle database errors during creation', async () => {
      mockDb.returning.mockRejectedValue(new Error('Constraint violation'));

      const userData = {
        username: 'newuser',
        password: 'hashedpassword',
        role: 'api-user' as const,
      };

      await expect(service.create(userData)).rejects.toThrow('Constraint violation');
    });
  });

  describe('updateApiKey', () => {
    it('should update and return user with new API key', async () => {
      const newApiKey = 'gapi_newkey123';
      const updatedUser = { ...mockUser, apiKey: newApiKey };
      
      mockDb.returning.mockResolvedValue([updatedUser]);

      const result = await service.updateApiKey('user-123', newApiKey);

      expect(result).toEqual(updatedUser);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith({
        apiKey: newApiKey,
        updatedAt: expect.any(Date),
      });
    });

    it('should handle non-existent user during API key update', async () => {
      mockDb.returning.mockResolvedValue([]);

      await expect(service.updateApiKey('nonexistent-id', 'gapi_key123'))
        .rejects.toThrow();
    });

    it('should update timestamps when updating API key', async () => {
      const newApiKey = 'gapi_newkey123';
      const mockDate = new Date('2024-02-01');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
      
      mockDb.returning.mockResolvedValue([mockUser]);

      await service.updateApiKey('user-123', newApiKey);

      expect(mockDb.set).toHaveBeenCalledWith({
        apiKey: newApiKey,
        updatedAt: mockDate,
      });

      jest.restoreAllMocks();
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      const users = [mockUser, { ...mockUser, id: 'user-456', username: 'user2' }];
      mockDb.select.mockResolvedValue(users);

      const result = await service.findAll();

      expect(result).toEqual(users);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return empty array when no users exist', async () => {
      mockDb.select.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete user by id', async () => {
      await service.delete('user-123');

      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should handle deletion of non-existent user', async () => {
      // This should not throw an error - delete operations are typically idempotent
      await expect(service.delete('nonexistent-id')).resolves.not.toThrow();
    });

    it('should handle database errors during deletion', async () => {
      mockDb.delete.mockRejectedValue(new Error('Foreign key constraint'));

      await expect(service.delete('user-123')).rejects.toThrow('Foreign key constraint');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined database responses', async () => {
      mockDb.limit.mockResolvedValue(undefined);

      const result = await service.findByUsername('testuser');

      expect(result).toBeNull();
    });

    it('should handle null database responses', async () => {
      mockDb.limit.mockResolvedValue(null);

      const result = await service.findByUsername('testuser');

      expect(result).toBeNull();
    });

    it('should handle empty string parameters', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await service.findByUsername('');

      expect(result).toBeNull();
    });

    it('should handle special characters in username', async () => {
      const specialUser = { ...mockUser, username: 'user@test.com' };
      mockDb.limit.mockResolvedValue([specialUser]);

      const result = await service.findByUsername('user@test.com');

      expect(result).toEqual(specialUser);
    });

    it('should handle very long usernames', async () => {
      const longUsername = 'a'.repeat(100);
      mockDb.limit.mockResolvedValue([]);

      const result = await service.findByUsername(longUsername);

      expect(result).toBeNull();
    });

    it('should handle case sensitivity in usernames', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await service.findByUsername('TestUser'); // Different case

      expect(result).toBeNull();
      // Note: In a real implementation, you might want case-insensitive search
    });
  });
});