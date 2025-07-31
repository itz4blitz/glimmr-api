import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
// import { JobsModule } from "../jobs/modules/jobs.module"; // Moved to external processing tools
import { RedisHealthIndicator } from "../redis/redis-health.service";

@Module({
  imports: [
    // JobsModule, // Moved to external processing tools
  ],
  controllers: [HealthController],
  providers: [HealthService, RedisHealthIndicator],
})
export class HealthModule {}
