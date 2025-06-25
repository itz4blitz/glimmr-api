import { ConfigService } from '@nestjs/config';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export interface QueueConfig {
  name: string;
  defaultJobOptions?: {
    removeOnComplete?: number;
    removeOnFail?: number;
    attempts?: number;
    backoff?: {
      type: string;
      delay: number;
    };
  };
}

export const QUEUE_NAMES = {
  HOSPITAL_IMPORT: 'hospital-import',
  PRICE_FILE_DOWNLOAD: 'price-file-download',
  PRICE_UPDATE: 'price-update',
  ANALYTICS_REFRESH: 'analytics-refresh',
  DATA_VALIDATION: 'data-validation',
  EXPORT_DATA: 'export-data',
  // PRA Data Pipeline Queues
  PRA_UNIFIED_SCAN: 'pra-unified-scan',
  PRA_FILE_DOWNLOAD: 'pra-file-download',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

export const QUEUE_CONFIGS: Record<QueueName, QueueConfig> = {
  [QUEUE_NAMES.HOSPITAL_IMPORT]: {
    name: QUEUE_NAMES.HOSPITAL_IMPORT,
    defaultJobOptions: {
      removeOnComplete: 5, // Reduced from 50
      removeOnFail: 10, // Reduced from 100
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  },
  [QUEUE_NAMES.PRICE_FILE_DOWNLOAD]: {
    name: QUEUE_NAMES.PRICE_FILE_DOWNLOAD,
    defaultJobOptions: {
      removeOnComplete: 3, // Reduced from 10
      removeOnFail: 5, // Reduced from 50
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 60000,
      },
    },
  },
  [QUEUE_NAMES.PRICE_UPDATE]: {
    name: QUEUE_NAMES.PRICE_UPDATE,
    defaultJobOptions: {
      removeOnComplete: 5, // Reduced from 100
      removeOnFail: 10, // Reduced from 50
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
  },
  [QUEUE_NAMES.ANALYTICS_REFRESH]: {
    name: QUEUE_NAMES.ANALYTICS_REFRESH,
    defaultJobOptions: {
      removeOnComplete: 3, // Reduced from 20
      removeOnFail: 5, // Reduced from 20
      attempts: 2,
      backoff: {
        type: 'fixed',
        delay: 5000,
      },
    },
  },
  [QUEUE_NAMES.DATA_VALIDATION]: {
    name: QUEUE_NAMES.DATA_VALIDATION,
    defaultJobOptions: {
      removeOnComplete: 3, // Reduced from 30
      removeOnFail: 5, // Reduced from 30
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1500,
      },
    },
  },
  [QUEUE_NAMES.EXPORT_DATA]: {
    name: QUEUE_NAMES.EXPORT_DATA,
    defaultJobOptions: {
      removeOnComplete: 3, // Reduced from 10
      removeOnFail: 5, // Reduced from 10
      attempts: 2,
      backoff: {
        type: 'fixed',
        delay: 3000,
      },
    },
  },
  // PRA Data Pipeline Queue Configurations
  [QUEUE_NAMES.PRA_UNIFIED_SCAN]: {
    name: QUEUE_NAMES.PRA_UNIFIED_SCAN,
    defaultJobOptions: {
      removeOnComplete: 3, // Reduced from 5
      removeOnFail: 5, // Reduced from 10
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 60000,
      },
    },
  },
  [QUEUE_NAMES.PRA_FILE_DOWNLOAD]: {
    name: QUEUE_NAMES.PRA_FILE_DOWNLOAD,
    defaultJobOptions: {
      removeOnComplete: 3, // Reduced from 20
      removeOnFail: 10, // Reduced from 50
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 60000,
      },
    },
  },
};

export function createRedisConnection(configService: ConfigService): IORedis {
  const redisUrl = configService.get<string>('REDIS_URL');
  const isProduction = configService.get('NODE_ENV') === 'production';

  // Use REDIS_* variables for both Redis (dev) and Valkey (prod)
  const connectionUrl = redisUrl;

  const baseOptions = {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false, // Disable for Valkey compatibility
    lazyConnect: true,
    connectTimeout: 30000, // Reasonable timeout
    commandTimeout: 15000, // Reasonable timeout
    family: 4, // Force IPv4
    enableOfflineQueue: false,
    showFriendlyErrorStack: true,
    // Reduce memory pressure
    maxMemoryPolicy: 'allkeys-lru',
  };

  // Different configurations for production (Valkey) vs development (Redis)
  const productionOptions = {
    ...baseOptions,
    retryDelayOnFailover: 1000,
    retryDelayOnClusterDown: 2000,
    keepAlive: 60000,
    // SSL/TLS for DigitalOcean managed Valkey service (only if using public endpoint)
    // Private network connections may not need TLS
    ...(process.env.VALKEY_HOST?.includes('private-') ? {} : {
      tls: {
        rejectUnauthorized: false, // DigitalOcean managed databases use self-signed certs
        checkServerIdentity: () => undefined, // Skip hostname verification
      },
    }),
    // Better reconnection for managed services
    reconnectOnError: (err: Error) => {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT'];
      return targetErrors.some(error => err.message.includes(error));
    },
  };

  const developmentOptions = {
    ...baseOptions,
    retryDelayOnFailover: 100,
    retryDelayOnClusterDown: 300,
    keepAlive: 30000,
    // Standard Redis reconnection
    reconnectOnError: (err: Error) => {
      const targetErrors = ['READONLY', 'ECONNRESET'];
      return targetErrors.some(error => err.message.includes(error));
    },
  };

  const options = isProduction ? productionOptions : developmentOptions;

  let redis: IORedis;

  if (connectionUrl) {
    redis = new IORedis(connectionUrl, options);
  } else {
    // Production uses VALKEY_* variables, development uses REDIS_* variables
    const host = isProduction
      ? configService.get<string>('VALKEY_HOST')
      : configService.get<string>('REDIS_HOST', 'localhost');
    const port = isProduction
      ? configService.get<number>('VALKEY_PORT')
      : configService.get<number>('REDIS_PORT', 6379);
    const password = isProduction
      ? configService.get<string>('VALKEY_PASSWORD')
      : configService.get<string>('REDIS_PASSWORD');
    const db = isProduction
      ? configService.get<number>('VALKEY_DB', 0)
      : configService.get<number>('REDIS_DB', 0);

    redis = new IORedis({
      host,
      port,
      password,
      db,
      ...options,
    });
  }

  // Minimal logging for production
  if (!isProduction) {
    redis.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });

    redis.on('connect', () => {
      console.log('Redis connected successfully');
    });

    redis.on('ready', () => {
      console.log('Redis ready for commands');
    });

    redis.on('close', () => {
      console.log('Redis connection closed');
    });

    redis.on('reconnecting', (ms: number) => {
      console.log(`Redis reconnecting in ${ms}ms`);
    });
  } else {
    // Production: Only log errors
    redis.on('error', (err) => {
      console.error('Valkey connection error:', err.message);
    });
  }

  return redis;
}

export function createQueues(redis: IORedis): { queues: Queue[]; adapters: BullMQAdapter[] } {
  const queues: Queue[] = [];
  const adapters: BullMQAdapter[] = [];

  Object.values(QUEUE_CONFIGS).forEach((config) => {
    const queue = new Queue(config.name, {
      connection: redis,
      defaultJobOptions: config.defaultJobOptions,
    });

    queues.push(queue);
    adapters.push(new BullMQAdapter(queue));
  });

  return { queues, adapters };
}
