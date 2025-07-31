import { Module } from "@nestjs/common";
// import { BullModule } from "@nestjs/bullmq"; // Moved to external processing tools
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { AuthModule } from "../auth/auth.module";
// import { QUEUE_NAMES } from "../jobs/queues/queue.config"; // Moved to external processing tools

@Module({
  imports: [
    AuthModule,
    // BullModule.registerQueue({
    //   name: QUEUE_NAMES.EXPORT_DATA,
    // }), // Moved to external processing tools
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
