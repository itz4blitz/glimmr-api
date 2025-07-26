import { Module } from "@nestjs/common";
import { BullBoardModule as BullBoardNestModule } from "@bull-board/nestjs";
import { ExpressAdapter } from "@bull-board/express";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { QUEUE_NAMES } from "../queues/queue.config";

@Module({
  imports: [
    BullBoardNestModule.forRoot({
      route: "/admin/queues",
      adapter: ExpressAdapter,
    }),
    BullBoardNestModule.forFeature({
      name: QUEUE_NAMES.PRICE_FILE_PARSER,
      adapter: BullMQAdapter,
    }),
    BullBoardNestModule.forFeature({
      name: QUEUE_NAMES.PRICE_UPDATE,
      adapter: BullMQAdapter,
    }),
    BullBoardNestModule.forFeature({
      name: QUEUE_NAMES.ANALYTICS_REFRESH,
      adapter: BullMQAdapter,
    }),
    BullBoardNestModule.forFeature({
      name: QUEUE_NAMES.EXPORT_DATA,
      adapter: BullMQAdapter,
    }),
    BullBoardNestModule.forFeature({
      name: QUEUE_NAMES.PRA_UNIFIED_SCAN,
      adapter: BullMQAdapter,
    }),
    BullBoardNestModule.forFeature({
      name: QUEUE_NAMES.PRA_FILE_DOWNLOAD,
      adapter: BullMQAdapter,
    }),
  ],
})
export class BullBoardModule {}
