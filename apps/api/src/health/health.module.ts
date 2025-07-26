import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { JobsModule } from "../jobs/modules/jobs.module";
import { RedisHealthIndicator } from "../redis/redis-health.service";

@Module({
  imports: [JobsModule],
  controllers: [HealthController],
  providers: [HealthService, RedisHealthIndicator],
})
export class HealthModule {}
