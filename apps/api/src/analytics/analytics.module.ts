import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AuthModule } from '../auth/auth.module';
import { QUEUE_NAMES } from '../jobs/queues/queue.config';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({
      name: QUEUE_NAMES.EXPORT_DATA,
    }),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
