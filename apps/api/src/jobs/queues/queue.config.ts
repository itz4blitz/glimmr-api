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

  const commonOptions = {
    maxRetriesPerRequest: null, // Required by BullMQ
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    lazyConnect: false,
    connectTimeout: 10000,
    commandTimeout: 5000,
    keepAlive: 30000,
    family: 4, // Force IPv4
    reconnectOnError: (err: Error) => {
      const targetError = 'READONLY';
      return err.message.includes(targetError);
    },
  };

  if (redisUrl) {
    return new IORedis(redisUrl, commonOptions);
  }

  return new IORedis({
    host: configService.get<string>('REDIS_HOST', 'localhost'),
    port: configService.get<number>('REDIS_PORT', 6379),
    password: configService.get<string>('REDIS_PASSWORD'),
    db: configService.get<number>('REDIS_DB', 0),
    ...commonOptions,
  });
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
