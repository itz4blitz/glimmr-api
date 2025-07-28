import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { PinoLogger, InjectPinoLogger } from "nestjs-pino";
import { schema, Schema } from "./schema";
import { createDatabaseConfig } from "./database.config";

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private client: postgres.Sql;
  private _db: PostgresJsDatabase<Schema>;

  constructor(
    private readonly configService: ConfigService,
    @InjectPinoLogger(DatabaseService.name)
    private readonly logger: PinoLogger,
  ) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    try {
      const config = createDatabaseConfig(this.configService);

      this.logger.info({
        msg: "Connecting to database",
        host: config.host,
        port: config.port,
        database: config.database,
        maxConnections: config.maxConnections,
      });

      // Create postgres client with connection pooling and monitoring
      this.client = postgres({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        database: config.database,
        ssl: config.ssl,
        max: config.maxConnections,
        idle_timeout: config.idleTimeoutMillis,
        connect_timeout: config.connectionTimeoutMillis,
        // Performance optimization: prepare statements for better performance
        prepare: true,
        // Transform configuration for better type safety
        transform: {
          undefined: null,
        },
        onnotice: (notice) => {
          this.logger.debug({
            msg: "Database notice",
            notice: notice.message,
          });
        },
        onparameter: (key, value) => {
          this.logger.debug({
            msg: "Database parameter",
            key,
            value,
          });
        },
      });

      // Initialize Drizzle with schema
      this._db = drizzle(this.client, { schema });

      // Test connection
      await this.client`SELECT 1 as test`;

      this.logger.info({
        msg: "Database connection established successfully",
        database: config.database,
      });
    } catch (_error) {
      this.logger.error({
        msg: "Failed to connect to database",
        error: (_error as Error).message,
        stack: (_error as Error).stack,
      });
      throw _error;
    }
  }

  private async disconnect() {
    if (this.client) {
      try {
        this.logger.info("Disconnecting from database");
        await this.client.end();
        this.logger.info("Database connection closed");
      } catch (_error) {
        this.logger.error({
          msg: "Error disconnecting from database",
          error: (_error as Error).message,
        });
      }
    }
  }

  get db(): PostgresJsDatabase<Schema> {
    if (!this._db) {
      throw new Error("Database not initialized. Call connect() first.");
    }
    return this._db;
  }

  get rawClient(): postgres.Sql {
    if (!this.client) {
      throw new Error("Database client not initialized. Call connect() first.");
    }
    return this.client;
  }

  // Health check method
  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    details?: {
      duration?: number;
      timestamp?: Date;
      error?: string;
    };
  }> {
    try {
      const startTime = Date.now();
      const _result = await this
        .client`SELECT 1 as health_check, NOW() as timestamp`;
      const duration = Date.now() - startTime;

      this.logger.debug({
        msg: "Database health check successful",
        duration,
        timestamp: _result[0]?.timestamp,
      });

      return {
        status: "healthy",
        details: {
          duration,
          timestamp: _result[0]?.timestamp,
        },
      };
    } catch (_error) {
      this.logger.error({
        msg: "Database health check failed",
        error: (_error as Error).message,
      });

      return {
        status: "unhealthy",
        details: {
          error: (_error as Error).message,
        },
      };
    }
  }

  // Transaction helper
  transaction<T>(
    callback: (tx: PostgresJsDatabase<Schema>) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(callback);
  }

  // Query performance logging wrapper
  async withLogging<T>(operation: string, query: () => Promise<T>): Promise<T> {
    const startTime = Date.now();

    try {
      const _result = await query();
      const duration = Date.now() - startTime;

      // Log slow queries (>1 second) as warnings
      const logLevel = duration > 1000 ? "warn" : "info";
      this.logger[logLevel]({
        msg: "Database query completed",
        operation,
        duration,
        success: true,
        ...(duration > 1000 && { slowQuery: true }),
      });

      return _result;
    } catch (_error) {
      const duration = Date.now() - startTime;

      this.logger.error({
        msg: "Database query failed",
        operation,
        duration,
        error: (_error as Error).message,
        success: false,
      });

      throw _error;
    }
  }

  // Get connection pool metrics for monitoring
  getConnectionPoolMetrics() {
    if (!this.client) {
      return { status: "not_connected" };
    }

    // Note: postgres.js doesn't expose detailed pool metrics,
    // but we can provide basic connection info
    return {
      status: "connected",
      configuredMaxConnections: this.configService.get(
        "DATABASE_MAX_CONNECTIONS",
        20,
      ),
      idleTimeout: this.configService.get("DATABASE_IDLE_TIMEOUT", 30000),
      connectionTimeout: this.configService.get(
        "DATABASE_CONNECTION_TIMEOUT",
        2000,
      ),
    };
  }
}
