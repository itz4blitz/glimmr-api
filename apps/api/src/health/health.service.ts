import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  async getHealth() {
    const uptime = process.uptime();
    const timestamp = new Date().toISOString();
    
    return {
      status: 'ok',
      timestamp,
      uptime: `${Math.floor(uptime)}s`,
      version: '1.0.0',
      service: 'Glimmr API',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        api: 'healthy',
        memory: this.getMemoryUsage(),
      },
    };
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
