import {
  Module,
  RequestMethod,
  NestModule,
  MiddlewareConsumer,
} from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { HealthModule } from "./health/health.module";
import {
  SerializedRequest,
  SerializedResponse,
  SerializedError,
} from "./common/types/http";
// import type { IncomingMessage } // Unused import from "http";
import type { Request } from "express";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get("NODE_ENV") === "production";

        return {
          pinoHttp: {
            name: "glimmr-api",
            level: isProduction ? "info" : "debug",
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
            genReqId: (req) => {
              return (
                req.headers["x-request-id"] ??
                req.headers["x-correlation-id"] ??
                `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
              );
            },
            customProps: (req) => ({
              userAgent: req.headers["user-agent"],
              ip:
                (req as unknown as Request & { ip?: string }).ip ??
                req.socket?.remoteAddress,
              method: req.method,
              url: req.url,
            }),
            serializers: {
              req: (req): SerializedRequest => ({
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
                remoteAddress: req.ip ?? req.connection?.remoteAddress,
                remotePort: req.connection?.remotePort,
              }),
              res: (res): SerializedResponse => ({
                statusCode: res.statusCode,
                headers: {
                  "content-type": res.headers?.["content-type"],
                  "content-length": res.headers?.["content-length"],
                },
              }),
              err: (err): SerializedError => ({
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
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppTestModule implements NestModule {
  configure(_consumer: MiddlewareConsumer) {
    // Skip middleware configuration for testing
  }
}
