import { Module } from "@nestjs/common";
import { HospitalsController } from "./hospitals.controller";
import { HospitalsService } from "./hospitals.service";
import { ExternalApisModule } from "../external-apis/external-apis.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [ExternalApisModule, AuthModule],
  controllers: [HospitalsController],
  providers: [HospitalsService],
  exports: [HospitalsService],
})
export class HospitalsModule {}
