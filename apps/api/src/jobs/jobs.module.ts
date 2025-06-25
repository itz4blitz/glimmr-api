import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../database/database.module.js';
import { ExternalApisModule } from '../external-apis/external-apis.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { HospitalsModule } from '../hospitals/hospitals.module.js';
import { createRedisConnection, QUEUE_NAMES } from './queues/queue.config.js';
import { HospitalImportProcessor } from './processors/hospital-import.processor.js';
import { PriceFileDownloadProcessor } from './processors/price-file-download.processor.js';
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
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.HOSPITAL_IMPORT },
      { name: QUEUE_NAMES.PRICE_FILE_DOWNLOAD },
      { name: QUEUE_NAMES.PRICE_UPDATE },
      { name: QUEUE_NAMES.ANALYTICS_REFRESH },
      { name: QUEUE_NAMES.DATA_VALIDATION },
      { name: QUEUE_NAMES.EXPORT_DATA },
      // PRA Data Pipeline Queues
      { name: QUEUE_NAMES.PRA_UNIFIED_SCAN },
      { name: QUEUE_NAMES.PRA_FILE_DOWNLOAD },
    ),
  ],
  controllers: [JobsController],
  providers: [
    JobsService,
    HospitalImportProcessor,
    PriceFileDownloadProcessor,
    PRAFileDownloadProcessor,
    PRAUnifiedScannerProcessor,
    HospitalMonitorService,
    PRAPipelineService,
  ],
  exports: [JobsService, HospitalMonitorService, PRAPipelineService],
})
export class JobsModule {}
