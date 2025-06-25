import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../database/database.module.js';
import { ExternalApisModule } from '../external-apis/external-apis.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { HospitalsModule } from '../hospitals/hospitals.module.js';
import { createRedisConnection, QUEUE_NAMES } from './queues/queue.config.js';
// Removed unused processors to reduce memory usage
// import { HospitalImportProcessor } from './processors/hospital-import.processor.js';
// import { PriceFileDownloadProcessor } from './processors/price-file-download.processor.js';
import { PRAFileDownloadProcessor } from './processors/pra-file-download.processor.js';
import { PRAUnifiedScannerProcessor } from './processors/pra-unified-scanner.processor.js';
import { HospitalMonitorService } from './services/hospital-monitor.service.js';
import { PRAPipelineService } from './services/pra-pipeline.service.js';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    ExternalApisModule,
    StorageModule,
    HospitalsModule,
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: createRedisConnection(configService),
        defaultJobOptions: {
          removeOnComplete: 3, // Global limit for memory
          removeOnFail: 5,
        },
      }),
      inject: [ConfigService],
    }),
    // Register all queues required by JobsService
    BullModule.registerQueue(
      {
        name: QUEUE_NAMES.HOSPITAL_IMPORT,
        processors: [{
          path: join(__dirname, 'processors', 'hospital-import.processor.js'),
          concurrency: 1
        }]
      },
      {
        name: QUEUE_NAMES.PRICE_FILE_DOWNLOAD,
        processors: [{
          path: join(__dirname, 'processors', 'price-file-download.processor.js'),
          concurrency: 1
        }]
      },
      {
        name: QUEUE_NAMES.PRICE_UPDATE,
        // No processor needed for this queue
      },
      {
        name: QUEUE_NAMES.ANALYTICS_REFRESH,
        // No processor needed for this queue
      },
      {
        name: QUEUE_NAMES.DATA_VALIDATION,
        // No processor needed for this queue
      },
      {
        name: QUEUE_NAMES.EXPORT_DATA,
        // No processor needed for this queue
      },
      {
        name: QUEUE_NAMES.PRA_UNIFIED_SCAN,
        processors: [{
          path: join(__dirname, 'processors', 'pra-unified-scanner.processor.js'),
          concurrency: 1
        }]
      },
      {
        name: QUEUE_NAMES.PRA_FILE_DOWNLOAD,
        processors: [{
          path: join(__dirname, 'processors', 'pra-file-download.processor.js'),
          concurrency: 1
        }]
      },
    ),
  ],
  controllers: [JobsController],
  providers: [
    JobsService,
    // Only register essential processors to reduce memory usage
    PRAFileDownloadProcessor,
    PRAUnifiedScannerProcessor,
    HospitalMonitorService,
    PRAPipelineService,
  ],
  exports: [JobsService, HospitalMonitorService, PRAPipelineService],
})
export class JobsModule {}
