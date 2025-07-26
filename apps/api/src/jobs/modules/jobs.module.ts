import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ScheduleModule } from "@nestjs/schedule";
import { DatabaseModule } from "../../database/database.module";
import { ExternalApisModule } from "../../external-apis/external-apis.module";
import { StorageModule } from "../../storage/storage.module";
import { HospitalsModule } from "../../hospitals/hospitals.module";
import { NotificationsModule } from "../../notifications/notifications.module";
import { createRedisConnection, QUEUE_NAMES } from "../queues/queue.config";
import { ExportDataProcessor } from "../processors/export-data.processor";
import { PRAUnifiedScanProcessor } from "../processors/pra-unified-scan.processor";
import { PRAFileDownloadProcessor } from "../processors/pra-file-download.processor";
import { PriceFileParserProcessor } from "../processors/price-file-parser.processor";
import { PriceNormalizationProcessor } from "../processors/price-normalization.processor";
import { AnalyticsRefreshProcessor } from "../processors/analytics-refresh.processor";
import { HospitalMonitorService } from "../services/pipelines/hospital-monitor.service";
import { PRAPipelineService } from "../services/pipelines/pra-pipeline.service";
import { JobCleanupService } from "../services/operations/job-cleanup.service";
import { JobMonitorService } from "../services/monitoring/job-monitor.service";
import { JobAnalyticsService } from "../services/monitoring/job-analytics.service";
import { JobExportService } from "../services/operations/job-export.service";
import { JobSchedulingService } from "../services/operations/job-scheduling.service";
import { JobEventListener } from "../listeners/job-event.listener";
import { JobsController } from "../controllers/jobs.controller";
import { JobsService } from "../services/core/jobs.service";
import { JobsGateway } from "../gateways/jobs.gateway";
import { ScheduleProcessor } from "../processors/schedule.processor";

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    ExternalApisModule,
    StorageModule,
    HospitalsModule,
    NotificationsModule,
    ScheduleModule.forRoot(),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
        signOptions: { expiresIn: "1d" },
      }),
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: createRedisConnection(configService),
        defaultJobOptions: {
          removeOnComplete: 5, // Keep more for debugging
          removeOnFail: 10,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        },
      }),
      inject: [ConfigService],
    }),
    // Register all required queues - optimized Redis connection should handle this
    BullModule.registerQueue(
      {
        name: QUEUE_NAMES.EXPORT_DATA,
      },
      {
        name: QUEUE_NAMES.ANALYTICS_REFRESH,
      },
      {
        name: QUEUE_NAMES.PRICE_FILE_PARSER,
      },
      {
        name: QUEUE_NAMES.PRICE_UPDATE,
      },
      {
        name: QUEUE_NAMES.PRA_UNIFIED_SCAN,
      },
      {
        name: QUEUE_NAMES.PRA_FILE_DOWNLOAD,
      },
    ),
  ],
  controllers: [JobsController],
  providers: [
    JobsService,
    JobsGateway,
    ExportDataProcessor,
    PRAUnifiedScanProcessor,
    PRAFileDownloadProcessor,
    PriceFileParserProcessor,
    PriceNormalizationProcessor,
    AnalyticsRefreshProcessor,
    HospitalMonitorService,
    PRAPipelineService,
    JobCleanupService,
    JobMonitorService,
    JobAnalyticsService,
    JobExportService,
    JobSchedulingService,
    JobEventListener,
    ScheduleProcessor,
  ],
  exports: [
    JobsService,
    JobsGateway,
    HospitalMonitorService,
    PRAPipelineService,
    JobCleanupService,
    JobMonitorService,
    JobAnalyticsService,
    JobExportService,
    JobSchedulingService,
  ],
})
export class JobsModule {}
