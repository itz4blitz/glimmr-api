import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { JobsService } from '../jobs/jobs.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly jobsService: JobsService,
    @InjectPinoLogger(HealthService.name)
    private readonly logger: PinoLogger,
  ) {}

  async getHealth() {
    const uptime = process.uptime();
    const timestamp = new Date().toISOString();
    
    // Run health checks
    const [databaseHealth, redisHealth, queueHealth] = await Promise.allSettled([
      this.checkDatabaseHealth(),
      this.checkRedisHealth(),
      this.checkQueueHealth(),
    ]);

    const checks = {
      api: 'healthy',
      memory: this.getMemoryUsage(),
      database: databaseHealth.status === 'fulfilled' ? databaseHealth.value : { status: 'unhealthy', error: databaseHealth.reason?.message },
      redis: redisHealth.status === 'fulfilled' ? redisHealth.value : { status: 'unhealthy', error: redisHealth.reason?.message },
      queues: queueHealth.status === 'fulfilled' ? queueHealth.value : { status: 'unhealthy', error: queueHealth.reason?.message },
    };

    // Determine overall status
    const hasUnhealthy = Object.values(checks).some(check => 
      typeof check === 'object' && check !== null && 'status' in check && check.status === 'unhealthy'
    );
    const hasDegraded = Object.values(checks).some(check => 
      typeof check === 'object' && check !== null && 'status' in check && check.status === 'degraded'
    );
    
    let overallStatus = 'healthy';
    if (hasUnhealthy) {
      overallStatus = 'unhealthy';
    } else if (hasDegraded) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp,
      uptime: `${Math.floor(uptime)}s`,
      version: '1.0.0',
      service: 'Glimmr API',
      environment: process.env.NODE_ENV || 'development',
      checks,
    };
  }

  private async checkDatabaseHealth() {
    try {
      const result = await this.databaseService.healthCheck();
      return result;
    } catch (error) {
      this.logger.error({
        msg: 'Database health check failed',
        error: error.message,
      });
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  private async checkRedisHealth() {
    let redisClient;
    try {
      const redisUrl = this.configService.get<string>('REDIS_URL');
      if (!redisUrl) {
        return {
          status: 'unhealthy',
          error: 'Redis URL not configured',
        };
      }

      redisClient = createClient({ url: redisUrl });
      await redisClient.connect();
      
      const startTime = Date.now();
      await redisClient.ping();
      const duration = Date.now() - startTime;
      
      await redisClient.quit();
      
      return {
        status: 'healthy',
        details: {
          duration,
          url: redisUrl.replace(/:[^:]*@/, ':***@'), // Hide password
        },
      };
    } catch (error) {
      this.logger.error({
        msg: 'Redis health check failed',
        error: error.message,
      });
      
      // Ensure connection is closed
      if (redisClient) {
        try {
          await redisClient.quit();
        } catch (closeError) {
          // Ignore close errors
        }
      }
      
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  private async checkQueueHealth() {
    try {
      const queueHealthResult = await this.jobsService.getQueueHealth();
      
      // Determine overall queue health status
      const hasErrors = queueHealthResult.summary.error > 0;
      const hasWarnings = queueHealthResult.summary.warning > 0;
      
      let status = 'healthy';
      if (hasErrors) {
        status = 'unhealthy';
      } else if (hasWarnings) {
        status = 'degraded';
      }

      return {
        status,
        details: {
          totalQueues: queueHealthResult.summary.total,
          healthy: queueHealthResult.summary.healthy,
          warning: queueHealthResult.summary.warning,
          error: queueHealthResult.summary.error,
          overallStatus: queueHealthResult.overallStatus,
        },
        issues: queueHealthResult.queues
          .filter(q => q.status !== 'healthy')
          .map(q => `${q.name}: ${q.issues.join(', ')}`),
      };
    } catch (error) {
      this.logger.error({
        msg: 'Queue health check failed',
        error: error.message,
      });
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  private getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    };
  }
}
