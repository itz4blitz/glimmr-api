import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';
import { PinoLogger } from 'nestjs-pino';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

// Mock postgres and drizzle
jest.mock('postgres');
jest.mock('drizzle-orm/postgres-js');

// Mock the createDatabaseConfig function
jest.mock('./database.config', () => ({
  createDatabaseConfig: jest.fn(),
}));

describe('DatabaseService', () => {
  let service: DatabaseService;
  let configService: ConfigService;
  let logger: PinoLogger;

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const mockPostgresClient = {
    sql: jest.fn(),
    end: jest.fn(),
  };

  const mockDrizzleDb = {
    transaction: jest.fn(),
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockDatabaseConfig = {
    host: 'localhost',
    port: 5432,
    username: 'test',
    password: 'test',
    database: 'test_db',
    ssl: false,
    maxConnections: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);
    configService = module.get<ConfigService>(ConfigService);
    logger = module.get<PinoLogger>(PinoLogger);

    // Reset mocks
    (postgres as unknown as jest.Mock).mockReturnValue(mockPostgresClient);
    (drizzle as unknown as jest.Mock).mockReturnValue(mockDrizzleDb);
    
    const { createDatabaseConfig } = require('./database.config');
    createDatabaseConfig.mockReturnValue(mockDatabaseConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should connect to database on module initialization', async () => {
      // Mock successful connection test
      mockPostgresClient.sql = jest.fn().mockImplementation((template) => {
        if (template && template[0] === 'SELECT 1 as test') {
          return Promise.resolve([{ test: 1 }]);
        }
        return Promise.resolve();
      });

      await service.onModuleInit();

      expect(postgres).toHaveBeenCalledWith({
        host: mockDatabaseConfig.host,
        port: mockDatabaseConfig.port,
        username: mockDatabaseConfig.username,
        password: mockDatabaseConfig.password,
        database: mockDatabaseConfig.database,
        ssl: mockDatabaseConfig.ssl,
        max: mockDatabaseConfig.maxConnections,
        idle_timeout: mockDatabaseConfig.idleTimeoutMillis,
        connect_timeout: mockDatabaseConfig.connectionTimeoutMillis,
        onnotice: expect.any(Function),
        onparameter: expect.any(Function),
      });

      expect(drizzle).toHaveBeenCalledWith(mockPostgresClient, { schema: expect.any(Object) });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Connecting to database',
        host: mockDatabaseConfig.host,
        port: mockDatabaseConfig.port,
        database: mockDatabaseConfig.database,
        maxConnections: mockDatabaseConfig.maxConnections,
      });

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Database connection established successfully',
        database: mockDatabaseConfig.database,
      });
    });

    it('should handle connection errors', async () => {
      const connectionError = new Error('Connection failed');
      mockPostgresClient.sql = jest.fn().mockRejectedValue(connectionError);

      await expect(service.onModuleInit()).rejects.toThrow(connectionError);

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Failed to connect to database',
        error: connectionError.message,
        stack: connectionError.stack,
      });
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect from database on module destruction', async () => {
      // First initialize the service
      mockPostgresClient.sql = jest.fn().mockResolvedValue([{ test: 1 }]);
      await service.onModuleInit();

      // Mock successful disconnection
      mockPostgresClient.end.mockResolvedValue(undefined);

      await service.onModuleDestroy();

      expect(mockPostgresClient.end).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Disconnecting from database');
      expect(mockLogger.info).toHaveBeenCalledWith('Database connection closed');
    });

    it('should handle disconnection errors', async () => {
      // First initialize the service
      mockPostgresClient.sql = jest.fn().mockResolvedValue([{ test: 1 }]);
      await service.onModuleInit();

      // Mock disconnection error
      const disconnectionError = new Error('Disconnection failed');
      mockPostgresClient.end.mockRejectedValue(disconnectionError);

      await service.onModuleDestroy();

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Error disconnecting from database',
        error: disconnectionError.message,
      });
    });

    it('should handle missing client gracefully', async () => {
      // Don't initialize the service, so client is undefined
      await service.onModuleDestroy();

      // Should not throw any errors
      expect(mockPostgresClient.end).not.toHaveBeenCalled();
    });
  });

  describe('db getter', () => {
    it('should return the drizzle database instance', async () => {
      // First initialize the service
      mockPostgresClient.sql = jest.fn().mockResolvedValue([{ test: 1 }]);
      await service.onModuleInit();

      const db = service.db;

      expect(db).toBe(mockDrizzleDb);
    });

    it('should throw error when database is not initialized', () => {
      expect(() => service.db).toThrow('Database not initialized. Call connect() first.');
    });
  });

  describe('rawClient getter', () => {
    it('should return the postgres client instance', async () => {
      // First initialize the service
      mockPostgresClient.sql = jest.fn().mockResolvedValue([{ test: 1 }]);
      await service.onModuleInit();

      const client = service.rawClient;

      expect(client).toBe(mockPostgresClient);
    });

    it('should throw error when client is not initialized', () => {
      expect(() => service.rawClient).toThrow('Database client not initialized. Call connect() first.');
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when database is accessible', async () => {
      // First initialize the service
      mockPostgresClient.sql = jest.fn().mockResolvedValue([{ test: 1 }]);
      await service.onModuleInit();

      // Mock health check query
      const healthCheckResult = [{ health_check: 1, timestamp: new Date() }];
      mockPostgresClient.sql = jest.fn().mockImplementation((template) => {
        if (template && template[0] && template[0].includes('health_check')) {
          return Promise.resolve(healthCheckResult);
        }
        return Promise.resolve([{ test: 1 }]);
      });

      const result = await service.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.details.duration).toBeGreaterThanOrEqual(0);
      expect(result.details.timestamp).toBeDefined();

      expect(mockLogger.debug).toHaveBeenCalledWith({
        msg: 'Database health check successful',
        duration: expect.any(Number),
        timestamp: expect.any(Date),
      });
    });

    it('should return unhealthy status when database query fails', async () => {
      // First initialize the service
      mockPostgresClient.sql = jest.fn().mockResolvedValue([{ test: 1 }]);
      await service.onModuleInit();

      // Mock health check query failure
      const healthCheckError = new Error('Health check query failed');
      mockPostgresClient.sql = jest.fn().mockImplementation((template) => {
        if (template && template[0] && template[0].includes('health_check')) {
          return Promise.reject(healthCheckError);
        }
        return Promise.resolve([{ test: 1 }]);
      });

      const result = await service.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.details.error).toBe('Health check query failed');

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Database health check failed',
        error: 'Health check query failed',
      });
    });

    it('should handle missing client in health check', async () => {
      // Don't initialize the service
      const result = await service.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.details.error).toContain('not initialized');
    });
  });

  describe('transaction', () => {
    it('should execute transaction successfully', async () => {
      // First initialize the service
      mockPostgresClient.sql = jest.fn().mockResolvedValue([{ test: 1 }]);
      await service.onModuleInit();

      const mockTransactionCallback = jest.fn().mockResolvedValue('transaction result');
      const mockTransactionResult = 'transaction result';
      mockDrizzleDb.transaction.mockResolvedValue(mockTransactionResult);

      const result = await service.transaction(mockTransactionCallback);

      expect(result).toBe(mockTransactionResult);
      expect(mockDrizzleDb.transaction).toHaveBeenCalledWith(mockTransactionCallback);
    });

    it('should handle transaction errors', async () => {
      // First initialize the service
      mockPostgresClient.sql = jest.fn().mockResolvedValue([{ test: 1 }]);
      await service.onModuleInit();

      const mockTransactionCallback = jest.fn();
      const transactionError = new Error('Transaction failed');
      mockDrizzleDb.transaction.mockRejectedValue(transactionError);

      await expect(service.transaction(mockTransactionCallback)).rejects.toThrow(transactionError);
    });
  });

  describe('withLogging', () => {
    it('should log successful query execution', async () => {
      // First initialize the service
      mockPostgresClient.sql = jest.fn().mockResolvedValue([{ test: 1 }]);
      await service.onModuleInit();

      const mockQuery = jest.fn().mockResolvedValue('query result');
      const operation = 'test operation';

      const result = await service.withLogging(operation, mockQuery);

      expect(result).toBe('query result');
      expect(mockQuery).toHaveBeenCalled();

      expect(mockLogger.info).toHaveBeenCalledWith({
        msg: 'Database query completed',
        operation,
        duration: expect.any(Number),
        success: true,
      });
    });

    it('should log failed query execution', async () => {
      // First initialize the service
      mockPostgresClient.sql = jest.fn().mockResolvedValue([{ test: 1 }]);
      await service.onModuleInit();

      const queryError = new Error('Query failed');
      const mockQuery = jest.fn().mockRejectedValue(queryError);
      const operation = 'test operation';

      await expect(service.withLogging(operation, mockQuery)).rejects.toThrow(queryError);

      expect(mockLogger.error).toHaveBeenCalledWith({
        msg: 'Database query failed',
        operation,
        duration: expect.any(Number),
        error: 'Query failed',
        success: false,
      });
    });
  });

  describe('postgres client callbacks', () => {
    it('should handle onnotice callback', async () => {
      mockPostgresClient.sql = jest.fn().mockResolvedValue([{ test: 1 }]);
      
      await service.onModuleInit();

      // Get the onnotice callback from the postgres call
      const postgresCall = (postgres as unknown as jest.Mock).mock.calls[0][0];
      const onnotice = postgresCall.onnotice;

      // Call the callback with a mock notice
      const mockNotice = { message: 'Test notice' };
      onnotice(mockNotice);

      expect(mockLogger.debug).toHaveBeenCalledWith({
        msg: 'Database notice',
        notice: 'Test notice',
      });
    });

    it('should handle onparameter callback', async () => {
      mockPostgresClient.sql = jest.fn().mockResolvedValue([{ test: 1 }]);
      
      await service.onModuleInit();

      // Get the onparameter callback from the postgres call
      const postgresCall = (postgres as unknown as jest.Mock).mock.calls[0][0];
      const onparameter = postgresCall.onparameter;

      // Call the callback with mock parameters
      onparameter('timezone', 'UTC');

      expect(mockLogger.debug).toHaveBeenCalledWith({
        msg: 'Database parameter',
        key: 'timezone',
        value: 'UTC',
      });
    });
  });
});