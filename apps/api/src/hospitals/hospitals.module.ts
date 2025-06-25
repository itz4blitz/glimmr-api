import { Module } from '@nestjs/common';
import { HospitalsController } from './hospitals.controller.js';
import { HospitalsService } from './hospitals.service.js';
import { ExternalApisModule } from '../external-apis/external-apis.module.js';

@Module({
  imports: [ExternalApisModule],
  controllers: [HospitalsController],
  providers: [HospitalsService],
  exports: [HospitalsService],
})
export class HospitalsModule {}
