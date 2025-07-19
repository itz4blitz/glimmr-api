import { Module } from '@nestjs/common';
import { HospitalsController } from './hospitals.controller.js';
import { HospitalsService } from './hospitals.service.js';
import { ExternalApisModule } from '../external-apis/external-apis.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [ExternalApisModule, AuthModule],
  controllers: [HospitalsController],
  providers: [HospitalsService],
  exports: [HospitalsService],
})
export class HospitalsModule {}
