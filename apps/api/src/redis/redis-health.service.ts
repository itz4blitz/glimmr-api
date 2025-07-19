import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSharedRedisConnection } from './redis.config';
import IORedis from 'ioredis';

export interface RedisHealthResult {
  status: 'connected' | 'disconnected';
  duration?: string;
  host?: string;
  port?: number;
  db?: number;
  error?: string;
}

@Injectable()
export class RedisHealthIndicator {
  private redis: IORedis;

  constructor(private readonly configService: ConfigService) {
    this.redis = getSharedRedisConnection(configService);
  }

  async isHealthy(): Promise<RedisHealthResult> {
    try {
      const start = Date.now();
      await this.redis.ping();
      const duration = Date.now() - start;

      return {
        status: 'connected',
        duration: `${duration}ms`,
        host: this.redis.options.host,
        port: this.redis.options.port,
        db: this.redis.options.db,
      };
    } catch (error) {
      return {
        status: 'disconnected',
        error: error.message,
        host: this.redis.options.host,
        port: this.redis.options.port,
      };
    }
  }
}
