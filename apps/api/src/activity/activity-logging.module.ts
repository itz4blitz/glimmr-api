import { Module, Global } from "@nestjs/common";
import { ActivityLoggingService } from "./activity-logging.service";
import { ActivityLoggingInterceptor } from "./activity-logging.interceptor";
import { ActivityController } from "./activity.controller";
import { DatabaseModule } from "../database/database.module";

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [ActivityLoggingService, ActivityLoggingInterceptor],
  controllers: [ActivityController],
  exports: [ActivityLoggingService],
})
export class ActivityLoggingModule {}
