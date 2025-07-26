import {
  Module,
  RequestMethod,
  NestModule,
  MiddlewareConsumer,
} from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
// import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { HealthModule } from "./health/health.module";
import { HospitalsModule } from "./hospitals/hospitals.module";
import { PricesModule } from "./prices/prices.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { JobsModule } from "./jobs/modules/jobs.module";
import { BullBoardModule } from "./jobs/modules/bull-board.module";
import { ODataModule } from "./odata/odata.module";
import { DatabaseModule } from "./database/database.module";
import { RedisModule } from "./redis/redis.module";
import { ExternalApisModule } from "./external-apis/external-apis.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { ActivityLoggingModule } from "./activity/activity-logging.module";
import { ActivityLoggingInterceptor } from "./activity/activity-logging.interceptor";
import { RequestContextMiddleware } from "./common/middleware";
import { CustomThrottlerGuard } from "./common/guards/custom-throttler.guard";
import { BullBoardAuthMiddleware } from "./auth/middleware/bull-board-auth.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: "default",
            ttl: config.get("RATE_LIMIT_WINDOW_MS", 60000), // 1 minute default
            limit: config.get(
              "RATE_LIMIT_MAX_REQUESTS",
              process.env.NODE_ENV === "development" ? 10000 : 100,
            ),
          },
          {
            name: "expensive",
            ttl: config.get("RATE_LIMIT_WINDOW_MS", 60000), // 1 minute default
            limit: config.get(
              "RATE_LIMIT_MAX_REQUESTS_EXPENSIVE",
              process.env.NODE_ENV === "development" ? 1000 : 10,
            ),
          },
        ],
        // Note: Using default in-memory storage for simplicity
        // For production, consider using @nestjs/throttler with Redis integration
      }),
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get("NODE_ENV") === "production";
        const logLevel = config.get(
          "LOG_LEVEL",
          isProduction ? "info" : "debug",
        );

        return {
          pinoHttp: {
            name: "glimmr-api",
            level: logLevel,
            transport: !isProduction
              ? {
                  target: "pino-pretty",
                  options: {
                    colorize: true,
                    translateTime: "SYS:standard",
                    ignore: "pid,hostname",
                    singleLine: false,
                  },
                }
              : undefined,
            formatters: {
              level: (label: string) => {
                return { level: label };
              },
            },
            timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
            genReqId: (req: any) => {
              return (
                req.headers["x-request-id"] ??
                req.headers["x-correlation-id"] ??
                `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
              );
            },
            customProps: (req: any) => ({
              userAgent: req.headers["user-agent"],
              ip: req.ip ?? req.connection?.remoteAddress,
              method: req.method,
              url: req.url,
            }),
            serializers: {
              req: (req: any) => ({
                id: req.id,
                method: req.method,
                url: req.url,
                query: req.query,
                params: req.params,
                headers: {
                  host: req.headers.host,
                  "user-agent": req.headers["user-agent"],
                  "content-type": req.headers["content-type"],
                  authorization: req.headers.authorization
                    ? "[REDACTED]"
                    : undefined,
                },
                remoteAddress: req.remoteAddress,
                remotePort: req.remotePort,
              }),
              res: (res: any) => ({
                statusCode: res.statusCode,
                headers: {
                  "content-type": res.headers?.["content-type"],
                  "content-length": res.headers?.["content-length"],
                },
              }),
              err: (err: any) => ({
                type: err.constructor.name,
                message: err.message,
                stack: err.stack,
                code: err.code,
                statusCode: err.statusCode,
              }),
            },
          },
          exclude: [
            { method: RequestMethod.GET, path: "/health" },
            { method: RequestMethod.GET, path: "/health/ready" },
            { method: RequestMethod.GET, path: "/health/live" },
            { method: RequestMethod.GET, path: "/metrics" },
          ],
        };
      },
    }),
    // EventEmitterModule.forRoot(),
    DatabaseModule,
    RedisModule,
    HealthModule,
    HospitalsModule,
    PricesModule,
    AnalyticsModule,
    JobsModule,
    BullBoardModule,
    ODataModule,
    ExternalApisModule,
    AuthModule,
    UsersModule,
    NotificationsModule,
    DashboardModule,
    ActivityLoggingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityLoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestContextMiddleware)
      .exclude(
        { path: "/health", method: RequestMethod.GET },
        { path: "/health/ready", method: RequestMethod.GET },
        { path: "/health/live", method: RequestMethod.GET },
        { path: "/metrics", method: RequestMethod.GET },
      )
      .forRoutes("*");

    // Apply Bull Board authentication middleware
    consumer.apply(BullBoardAuthMiddleware).forRoutes("/admin/queues*");
  }
}
