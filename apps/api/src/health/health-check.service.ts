import { Injectable } from "@nestjs/common";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { DatabaseService } from "../database/database.service";
import { RedisPoolService } from "../redis/redis-pool.service";
import { StorageService } from "../storage/storage.service";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { QUEUE_NAMES } from "../jobs/queues/queue.config";

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  checks: {
    database: ComponentHealth;
    redis: ComponentHealth;
    storage: ComponentHealth;
    queues: ComponentHealth;
    jobs: ComponentHealth;
  };
  timestamp: string;
  uptime: number;
}

export interface ComponentHealth {
  status: "up" | "down" | "degraded";
  message?: string;
  latency?: number;
  details?: Record<string, unknown>;
}

@Injectable()
export class HealthCheckService {
  private startTime = Date.now();

  constructor(
    @InjectPinoLogger(HealthCheckService.name)
    private readonly logger: PinoLogger,
    private readonly databaseService: DatabaseService,
    private readonly redisPoolService: RedisPoolService,
    private readonly storageService: StorageService,
    @InjectQueue(QUEUE_NAMES.PRA_FILE_DOWNLOAD)
    private readonly downloadQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PRICE_FILE_PARSER)
    private readonly parserQueue: Queue,
  ) {}

  /**
   * Comprehensive health check
   */
  async checkHealth(): Promise<HealthCheckResult> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkStorage(),
      this.checkQueues(),
      this.checkJobs(),
    ]);

    const [database, redis, storage, queues, jobs] = checks;

    // Determine overall status
    const statuses = checks.map((c) => c.status);
    let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";

    if (statuses.includes("down")) {
      overallStatus = "unhealthy";
    } else if (statuses.includes("degraded")) {
      overallStatus = "degraded";
    }

    return {
      status: overallStatus,
      checks: {
        database,
        redis,
        storage,
        queues,
        jobs,
      },
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Check database health
   */
  private async checkDatabase(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      // Simple query to check connection
      await this.databaseService.db.execute("SELECT 1");
      
      const latency = Date.now() - start;
      
      return {
        status: latency < 1000 ? "up" : "degraded",
        latency,
        message: latency < 1000 ? "Database responding normally" : "Database slow",
      };
    } catch (_error) {
      this.logger.error({
        msg: "Database health check failed",
        error: (_error as Error).message,
      });
      
      return {
        status: "down",
        message: `Database error: ${(_error as Error).message}`,
        latency: Date.now() - start,
      };
    }
  }

  /**
   * Check Redis health
   */
  private async checkRedis(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      const connection = this.redisPoolService.getConnection();
      const pong = await connection.ping();
      
      const latency = Date.now() - start;
      const connectionStatus = this.redisPoolService.getConnectionStatus();
      
      // Check if all connections are healthy
      const unhealthyConnections = Object.entries(connectionStatus)
        .filter(([_, status]) => status !== "ready")
        .length;
      
      if (unhealthyConnections > 0) {
        return {
          status: "degraded",
          message: `${unhealthyConnections} Redis connections not ready`,
          latency,
          details: connectionStatus,
        };
      }
      
      return {
        status: pong === "PONG" && latency < 100 ? "up" : "degraded",
        latency,
        message: "Redis responding normally",
        details: connectionStatus,
      };
    } catch (_error) {
      this.logger.error({
        msg: "Redis health check failed",
        error: (_error as Error).message,
      });
      
      return {
        status: "down",
        message: `Redis error: ${(_error as Error).message}`,
        latency: Date.now() - start,
      };
    }
  }

  /**
   * Check storage health
   */
  private async checkStorage(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
      // Try to list files in a test directory
      await this.storageService.listFiles("health-check/", 1);
      
      const latency = Date.now() - start;
      
      return {
        status: latency < 2000 ? "up" : "degraded",
        latency,
        message: "Storage accessible",
      };
    } catch (_error) {
      this.logger.error({
        msg: "Storage health check failed",
        error: (_error as Error).message,
      });
      
      return {
        status: "down",
        message: `Storage error: ${(_error as Error).message}`,
        latency: Date.now() - start,
      };
    }
  }

  /**
   * Check queue health
   */
  private async checkQueues(): Promise<ComponentHealth> {
    try {
      const [downloadCounts, parserCounts] = await Promise.all([
        this.downloadQueue.getJobCounts(),
        this.parserQueue.getJobCounts(),
      ]);
      
      const totalStalled = downloadCounts.stalled + parserCounts.stalled;
      const totalFailed = downloadCounts.failed + parserCounts.failed;
      
      let status: "up" | "degraded" | "down" = "up";
      let message = "Queues operating normally";
      
      if (totalStalled > 10) {
        status = "degraded";
        message = `${totalStalled} stalled jobs detected`;
      }
      
      if (totalFailed > 100) {
        status = "degraded";
        message = `${totalFailed} failed jobs in queues`;
      }
      
      return {
        status,
        message,
        details: {
          download: downloadCounts,
          parser: parserCounts,
        },
      };
    } catch (_error) {
      this.logger.error({
        msg: "Queue health check failed",
        error: (_error as Error).message,
      });
      
      return {
        status: "down",
        message: `Queue error: ${(_error as Error).message}`,
      };
    }
  }

  /**
   * Check job processing health
   */
  private async checkJobs(): Promise<ComponentHealth> {
    try {
      const db = this.databaseService.db;
      
      // Count jobs by status from last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const { jobs: jobsTable } = await import("../database/schema");
      const { gte, count } = await import("drizzle-orm");
      
      const jobStats = await db
        .select({
          status: jobsTable.status,
          count: count(),
        })
        .from(jobsTable)
        .where(gte(jobsTable.createdAt, oneHourAgo))
        .groupBy(jobsTable.status);
      
      // Convert to object with status counts
      const statsByStatus = jobStats.reduce((acc, stat) => {
        acc[stat.status] = stat.count;
        return acc;
      }, {} as Record<string, number>);
      
      // Simple health logic - adjust based on your needs
      let status: "up" | "degraded" | "down" = "up";
      let message = "Job processing healthy";
      
      const failed = statsByStatus.failed || 0;
      const completed = statsByStatus.completed || 0;
      
      if (failed > completed * 0.2 && completed > 0) {
        status = "degraded";
        message = "High job failure rate";
      }
      
      return {
        status,
        message,
        details: statsByStatus,
      };
    } catch (_error) {
      this.logger.error({
        msg: "Job health check failed",
        error: (_error as Error).message,
      });
      
      return {
        status: "down",
        message: `Job check error: ${(_error as Error).message}`,
      };
    }
  }

  /**
   * Quick liveness check
   */
  isAlive(): boolean {
    return true; // Application is running
  }

  /**
   * Readiness check
   */
  async isReady(): Promise<boolean> {
    try {
      // Check critical components
      const [dbCheck, redisCheck] = await Promise.all([
        this.checkDatabase(),
        this.checkRedis(),
      ]);
      
      return dbCheck.status !== "down" && redisCheck.status !== "down";
    } catch (_error) {
      this.logger.error({
        msg: "Readiness check failed",
        error: (_error as Error).message,
      });
      return false;
    }
  }
}
