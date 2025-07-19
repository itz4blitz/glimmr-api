import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  maxRetriesPerRequest: null;
  lazyConnect: boolean;
  connectTimeout: number;
  commandTimeout: number;
  family: 4;
  enableOfflineQueue: boolean;
  retryDelayOnFailover: number;
  keepAlive: number;
  enableReadyCheck: boolean;
  showFriendlyErrorStack: boolean;
}

export const createRedisConfig = (configService: ConfigService): RedisConfig => {
  const isProduction = configService.get('NODE_ENV') === 'production';
  
  return {
    host: isProduction
      ? configService.get<string>('VALKEY_HOST', 'localhost')
      : configService.get<string>('REDIS_HOST', 'localhost'),
    port: isProduction
      ? configService.get<number>('VALKEY_PORT', 6379)
      : configService.get<number>('REDIS_PORT', 6379),
    password: isProduction
      ? configService.get<string>('VALKEY_PASSWORD')
      : configService.get<string>('REDIS_PASSWORD'),
    db: isProduction
      ? configService.get<number>('VALKEY_DB', 0)
      : configService.get<number>('REDIS_DB', 0),
    maxRetriesPerRequest: null, // Required by BullMQ
    lazyConnect: false, // Connect immediately for better error handling
    connectTimeout: isProduction ? 10000 : 5000,
    commandTimeout: isProduction ? 30000 : 10000,
    family: 4, // Force IPv4
    enableOfflineQueue: false, // Fail fast when Redis is down
    retryDelayOnFailover: isProduction ? 1000 : 100,
    keepAlive: isProduction ? 60000 : 30000,
    enableReadyCheck: true,
    showFriendlyErrorStack: !isProduction,
  };
};

export const createOptimizedRedisConnection = (configService: ConfigService): IORedis => {
  const config = createRedisConfig(configService);
  const isProduction = configService.get('NODE_ENV') === 'production';
  
  // Check for connection URL first
  const connectionUrl = isProduction 
    ? configService.get<string>('VALKEY_URL') || configService.get<string>('REDIS_URL')
    : configService.get<string>('REDIS_URL');

  let redis: IORedis;

  if (connectionUrl) {
    redis = new IORedis(connectionUrl, config);
  } else {
    redis = new IORedis(config);
  }

  // Add event listeners for monitoring
  if (!isProduction) {
    redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redis.on('ready', () => {
      console.log('✅ Redis ready for commands');
    });

    redis.on('error', (err) => {
      console.error('❌ Redis connection error:', err.message);
    });

    redis.on('close', () => {
      console.log('🔌 Redis connection closed');
    });

    redis.on('reconnecting', (ms: number) => {
      console.log(`🔄 Redis reconnecting in ${ms}ms`);
    });
  } else {
    // Production: Only log critical events
    redis.on('error', (err) => {
      console.error('Valkey connection error:', err.message);
    });

    redis.on('connect', () => {
      console.log('Valkey connected successfully');
    });
  }

  return redis;
};

// Connection pool for reusing connections across queues
let sharedConnection: IORedis | null = null;

export const getSharedRedisConnection = (configService: ConfigService): IORedis => {
  if (!sharedConnection) {
    sharedConnection = createOptimizedRedisConnection(configService);
  }
  return sharedConnection;
};

export const closeSharedRedisConnection = async (): Promise<void> => {
  if (sharedConnection) {
    await sharedConnection.quit();
    sharedConnection = null;
  }
};
