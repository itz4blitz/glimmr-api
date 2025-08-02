import { ConfigService } from "@nestjs/config";

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean | { rejectUnauthorized: boolean };
  maxConnections: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

export const createDatabaseConfig = (
  configService: ConfigService,
): DatabaseConfig => {
  const isProduction = configService.get("NODE_ENV") === "production";

  return {
    host: configService.get("DATABASE_HOST", "localhost"),
    port: configService.get("DATABASE_PORT", 5432),
    username: configService.get("DATABASE_USERNAME", "postgres"),
    password: configService.get("DATABASE_PASSWORD", "postgres"),
    database: configService.get("DATABASE_NAME", "glimmr"),
    ssl: configService.get("DATABASE_SSL", "false") === "true" 
      ? { rejectUnauthorized: false } 
      : false,
    maxConnections: configService.get("DATABASE_MAX_CONNECTIONS", 20),
    idleTimeoutMillis: configService.get("DATABASE_IDLE_TIMEOUT", 30000),
    connectionTimeoutMillis: configService.get(
      "DATABASE_CONNECTION_TIMEOUT",
      2000,
    ),
  };
};
