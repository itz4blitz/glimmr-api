import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import IORedis from "ioredis";
import { createRedisConfig } from "./redis.config";

/**
 * Redis connection pool service that manages multiple connections
 * and provides connection health monitoring
 */
@Injectable()
export class RedisPoolService implements OnModuleDestroy {
  private connections: Map<string, IORedis> = new Map();
  private healthCheckInterval: NodeJS.Timeout;
  private reconnectAttempts: Map<string, number> = new Map();
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

  constructor(
    private readonly configService: ConfigService,
    @InjectPinoLogger(RedisPoolService.name)
    private readonly logger: PinoLogger,
  ) {
    this.startHealthCheck();
  }

  /**
   * Get or create a Redis connection for a specific purpose
   */
  getConnection(name: string = "default"): IORedis {
    let connection = this.connections.get(name);

    if (!connection || connection.status === "end") {
      connection = this.createConnection(name);
      this.connections.set(name, connection);
    }

    return connection;
  }

  /**
   * Create a new Redis connection with enhanced error handling
   */
  private createConnection(name: string): IORedis {
    const config = createRedisConfig(this.configService);
    const isProduction = this.configService.get("NODE_ENV") === "production";

    // Enhanced configuration for reliability
    const enhancedConfig = {
      ...config,
      retryStrategy: (times: number) => {
        const attempts = this.reconnectAttempts.get(name) || 0;
        this.reconnectAttempts.set(name, attempts + 1);

        if (attempts >= this.MAX_RECONNECT_ATTEMPTS) {
          this.logger.error({
            msg: "Max reconnection attempts reached",
            connection: name,
            attempts,
          });
          return null; // Stop retrying
        }

        const delay = Math.min(times * 50, 2000);
        this.logger.warn({
          msg: "Redis connection retry",
          connection: name,
          attempt: times,
          delay,
        });
        return delay;
      },
      reconnectOnError: (err: Error) => {
        const targetError = "READONLY";
        if (err.message.includes(targetError)) {
          // Only reconnect when we get READONLY errors
          return true;
        }
        return false;
      },
    };

    const connectionUrl = isProduction
      ? this.configService.get<string>("VALKEY_URL") ||
        this.configService.get<string>("REDIS_URL")
      : this.configService.get<string>("REDIS_URL");

    const redis = connectionUrl
      ? new IORedis(connectionUrl, enhancedConfig)
      : new IORedis(enhancedConfig);

    // Connection event handlers
    redis.on("connect", () => {
      this.logger.info({
        msg: "Redis connection established",
        connection: name,
      });
      this.reconnectAttempts.set(name, 0);
    });

    redis.on("ready", () => {
      this.logger.info({
        msg: "Redis connection ready",
        connection: name,
      });
    });

    redis.on("error", (err) => {
      this.logger.error({
        msg: "Redis connection error",
        connection: name,
        error: err.message,
      });
    });

    redis.on("close", () => {
      this.logger.warn({
        msg: "Redis connection closed",
        connection: name,
      });
    });

    redis.on("reconnecting", (ms: number) => {
      this.logger.info({
        msg: "Redis reconnecting",
        connection: name,
        delay: ms,
      });
    });

    redis.on("end", () => {
      this.logger.error({
        msg: "Redis connection ended",
        connection: name,
      });
    });

    return redis;
  }

  /**
   * Start health check for all connections
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const [name, connection] of this.connections.entries()) {
        try {
          if (connection.status === "ready") {
            await connection.ping();
          } else {
            this.logger.warn({
              msg: "Redis connection not ready",
              connection: name,
              status: connection.status,
            });

            // Try to reconnect if disconnected
            if (connection.status === "end" || connection.status === "close") {
              this.logger.info({
                msg: "Attempting to reconnect",
                connection: name,
              });
              connection.connect().catch((err) => {
                this.logger.error({
                  msg: "Reconnection failed",
                  connection: name,
                  error: err.message,
                });
              });
            }
          }
        } catch (_error) {
          this.logger.error({
            msg: "Health check failed",
            connection: name,
            error: (_error as Error).message,
          });
        }
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Get connection status for monitoring
   */
  getConnectionStatus(): Record<string, string> {
    const status: Record<string, string> = {};
    for (const [name, connection] of this.connections.entries()) {
      status[name] = connection.status;
    }
    return status;
  }

  /**
   * Clean up on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    for (const [name, connection] of this.connections.entries()) {
      try {
        await connection.quit();
        this.logger.info({
          msg: "Redis connection closed",
          connection: name,
        });
      } catch (_error) {
        this.logger.error({
          msg: "Error closing Redis connection",
          connection: name,
          error: (_error as Error).message,
        });
      }
    }

    this.connections.clear();
  }
}
