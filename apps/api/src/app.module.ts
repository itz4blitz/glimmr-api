import { Module, RequestMethod, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { HospitalsModule } from './hospitals/hospitals.module';
import { PricesModule } from './prices/prices.module';
import { AnalyticsModule } from './analytics/analytics.module';
// import { JobsModule } from './jobs/jobs.module';
// import { JobsBullBoardModule } from './jobs/bull-board.module';
import { ODataModule } from './odata/odata.module';
import { DatabaseModule } from './database/database.module';
import { ExternalApisModule } from './external-apis/external-apis.module';
import { RequestContextMiddleware } from './common/middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get('NODE_ENV') === 'production';

        return {
          pinoHttp: {
            name: 'glimmr-api',
            level: isProduction ? 'info' : 'debug',
            transport: !isProduction ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
                singleLine: false,
              },
            } : undefined,
            formatters: {
              level: (label: string) => {
                return { level: label };
              },
            },
            timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
            genReqId: (req: any) => {
              return req.headers['x-request-id'] ??
                     req.headers['x-correlation-id'] ??
                     `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
            },
            customProps: (req: any) => ({
              userAgent: req.headers['user-agent'],
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
                  'user-agent': req.headers['user-agent'],
                  'content-type': req.headers['content-type'],
                  authorization: req.headers.authorization ? '[REDACTED]' : undefined,
                },
                remoteAddress: req.remoteAddress,
                remotePort: req.remotePort,
              }),
              res: (res: any) => ({
                statusCode: res.statusCode,
                headers: {
                  'content-type': res.headers?.['content-type'],
                  'content-length': res.headers?.['content-length'],
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
            { method: RequestMethod.GET, path: '/health' },
            { method: RequestMethod.GET, path: '/health/ready' },
            { method: RequestMethod.GET, path: '/health/live' },
            { method: RequestMethod.GET, path: '/metrics' },
          ],
        };
      },
    }),
    HealthModule,
    HospitalsModule,
    PricesModule,
    AnalyticsModule,
    JobsModule,
    JobsBullBoardModule,
    ODataModule,
    DatabaseModule,
    ExternalApisModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestContextMiddleware)
      .exclude(
        { path: '/health', method: RequestMethod.GET },
        { path: '/health/ready', method: RequestMethod.GET },
        { path: '/health/live', method: RequestMethod.GET },
        { path: '/metrics', method: RequestMethod.GET },
      )
      .forRoutes('*');
  }
}
