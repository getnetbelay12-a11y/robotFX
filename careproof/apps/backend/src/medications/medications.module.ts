import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { Client, ClientSchema } from '../clients/client.schema';
import { ExpirationRecord, ExpirationRecordSchema } from '../expiration-records/expiration-record.schema';
import { Notification, NotificationSchema } from '../family/notification.schema';
import { InspectionFinding, InspectionFindingSchema } from '../inspection-findings/inspection-finding.schema';
import { InspectionRule, InspectionRuleSchema } from '../inspection-findings/inspection-rule.schema';
import { MedicalAvailability, MedicalAvailabilitySchema } from '../medical-availability/medical-availability.schema';
import { NurseApproval, NurseApprovalSchema } from '../nurse-approvals/nurse-approval.schema';
import { Visit, VisitSchema } from '../visits/visit.schema';
import { MedicationRecord, MedicationRecordSchema } from './medication-record.schema';
import { MedicationsController } from './medications.controller';
import { MedicationsService } from './medications.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MedicationRecord.name, schema: MedicationRecordSchema },
      { name: Client.name, schema: ClientSchema },
      { name: Visit.name, schema: VisitSchema },
      { name: MedicalAvailability.name, schema: MedicalAvailabilitySchema },
      { name: ExpirationRecord.name, schema: ExpirationRecordSchema },
      { name: InspectionFinding.name, schema: InspectionFindingSchema },
      { name: InspectionRule.name, schema: InspectionRuleSchema },
      { name: NurseApproval.name, schema: NurseApprovalSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
    AuditModule,
  ],
  controllers: [MedicationsController],
  providers: [MedicationsService],
  exports: [MedicationsService],
})
export class MedicationsModule {}
