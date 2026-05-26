import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MedicalAvailability, MedicalAvailabilitySchema } from './medical-availability.schema';
import { MedicalAvailabilityService } from './medical-availability.service';
import { MedicalAvailabilityController } from './medical-availability.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: MedicalAvailability.name, schema: MedicalAvailabilitySchema }]),
    AuditModule,
  ],
  controllers: [MedicalAvailabilityController],
  providers: [MedicalAvailabilityService],
  exports: [MedicalAvailabilityService],
})
export class MedicalAvailabilityModule {}
