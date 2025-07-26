import { Module } from "@nestjs/common";
import { ODataController } from "./odata.controller";
import { ODataService } from "./odata.service";

@Module({
  controllers: [ODataController],
  providers: [ODataService],
  exports: [ODataService],
})
export class ODataModule {}
