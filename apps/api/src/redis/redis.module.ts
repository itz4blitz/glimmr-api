import { Module, Global } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { RedisPoolService } from "./redis-pool.service";
import { RedisHealthIndicator } from "./redis-health.service";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisPoolService, RedisHealthIndicator],
  exports: [RedisPoolService, RedisHealthIndicator],
})
export class RedisModule {}