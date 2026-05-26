import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InspectionRule, InspectionRuleSchema } from './inspection-rule.schema';
import { InspectionFinding, InspectionFindingSchema } from './inspection-finding.schema';
import { InspectionFindingsService } from './inspection-findings.service';
import { InspectionFindingsController } from './inspection-findings.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InspectionRule.name, schema: InspectionRuleSchema },
      { name: InspectionFinding.name, schema: InspectionFindingSchema },
    ]),
    AuditModule,
  ],
  controllers: [InspectionFindingsController],
  providers: [InspectionFindingsService],
  exports: [InspectionFindingsService],
})
export class InspectionFindingsModule {}
