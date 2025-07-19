import { ConfigService } from '@nestjs/config';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { getSharedRedisConnection } from '../../redis/redis.config';

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
  // Use the optimized shared connection for better resource management
  return getSharedRedisConnection(configService);
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


