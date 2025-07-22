import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../database/database.module';
import { ExternalApisModule } from '../external-apis/external-apis.module';
import { StorageModule } from '../storage/storage.module';
import { HospitalsModule } from '../hospitals/hospitals.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { createRedisConnection, QUEUE_NAMES } from './queues/queue.config';
import { ExportDataProcessor } from './processors/export-data.processor';
import { PRAUnifiedScanProcessor } from './processors/pra-unified-scan.processor';
import { PRAFileDownloadProcessor } from './processors/pra-file-download.processor';
import { PriceFileParserProcessor } from './processors/price-file-parser.processor';
import { PriceNormalizationProcessor } from './processors/price-normalization.processor';
import { AnalyticsRefreshProcessor } from './processors/analytics-refresh.processor';
import { HospitalMonitorService } from './services/hospital-monitor.service';
import { PRAPipelineService } from './services/pra-pipeline.service';
import { JobCleanupService } from './services/job-cleanup.service';
import { JobEventListener } from './listeners/job-event.listener';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { ScheduleProcessor } from './processors/schedule.processor';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    ExternalApisModule,
    StorageModule,
    HospitalsModule,
    NotificationsModule,
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: createRedisConnection(configService),
        defaultJobOptions: {
          removeOnComplete: 5, // Keep more for debugging
          removeOnFail: 10,
          attempts: 3,
          backoff: {
            type: 'exponential',
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
    ExportDataProcessor,
    PRAUnifiedScanProcessor,
    PRAFileDownloadProcessor,
    PriceFileParserProcessor,
    PriceNormalizationProcessor,
    AnalyticsRefreshProcessor,
    HospitalMonitorService,
    PRAPipelineService,
    JobCleanupService,
    JobEventListener,
    ScheduleProcessor,
  ],
  exports: [JobsService, HospitalMonitorService, PRAPipelineService, JobCleanupService],
})
export class JobsModule {}
