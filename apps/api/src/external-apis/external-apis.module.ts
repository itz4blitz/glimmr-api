import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PatientRightsAdvocateService } from './patient-rights-advocate.service.js';

@Module({
  imports: [ConfigModule],
  providers: [PatientRightsAdvocateService],
  exports: [PatientRightsAdvocateService],
})
export class ExternalApisModule {}
