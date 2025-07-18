import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

@Injectable()
export class HealthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    @InjectPinoLogger(HealthService.name)
    private readonly logger: PinoLogger,
  ) {}

  async getHealth() {
    const uptime = process.uptime();
    const timestamp = new Date().toISOString();
    
    // Run health checks
    const [databaseHealth, redisHealth] = await Promise.allSettled([
      this.checkDatabaseHealth(),
      this.checkRedisHealth(),
    ]);

    const checks = {
      api: 'healthy',
      memory: this.getMemoryUsage(),
      database: databaseHealth.status === 'fulfilled' ? databaseHealth.value : { status: 'unhealthy', error: databaseHealth.reason?.message },
      redis: redisHealth.status === 'fulfilled' ? redisHealth.value : { status: 'unhealthy', error: redisHealth.reason?.message },
    };

    // Determine overall status
    const overallStatus = Object.values(checks).some(check => 
      typeof check === 'object' && check !== null && 'status' in check && check.status === 'unhealthy'
    ) ? 'unhealthy' : 'healthy';

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

  private getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    };
  }
}
