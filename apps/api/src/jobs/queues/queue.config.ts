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
      removeOnComplete: 50,
      removeOnFail: 100,
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
      removeOnComplete: 10,
      removeOnFail: 50,
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
      removeOnComplete: 100,
      removeOnFail: 50,
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
      removeOnComplete: 20,
      removeOnFail: 20,
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
      removeOnComplete: 30,
      removeOnFail: 30,
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
      removeOnComplete: 10,
      removeOnFail: 10,
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
      removeOnComplete: 5,
      removeOnFail: 10,
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
      removeOnComplete: 20,
      removeOnFail: 50,
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
  const valkeyUrl = configService.get<string>('VALKEY_URL');
  const isProduction = configService.get('NODE_ENV') === 'production';

  // Production uses Valkey, development uses Redis
  const connectionUrl = isProduction ? (valkeyUrl ?? redisUrl) : redisUrl;

  const baseOptions = {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false, // Disable for Valkey compatibility
    lazyConnect: true,
    connectTimeout: 30000, // Increased timeout
    commandTimeout: 10000,
    family: 4, // Force IPv4
    enableOfflineQueue: false,
    showFriendlyErrorStack: true,
  };

  // Different configurations for production (Valkey) vs development (Redis)
  const productionOptions = {
    ...baseOptions,
    retryDelayOnFailover: 500,
    retryDelayOnClusterDown: 1000,
    keepAlive: 60000,
    // Minimal reconnection for Valkey
    reconnectOnError: () => false,
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
    redis = new IORedis({
      host: configService.get<string>(isProduction ? 'VALKEY_HOST' : 'REDIS_HOST', 'localhost'),
      port: configService.get<number>(isProduction ? 'VALKEY_PORT' : 'REDIS_PORT', 6379),
      password: configService.get<string>(isProduction ? 'VALKEY_PASSWORD' : 'REDIS_PASSWORD'),
      db: configService.get<number>(isProduction ? 'VALKEY_DB' : 'REDIS_DB', 0),
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
