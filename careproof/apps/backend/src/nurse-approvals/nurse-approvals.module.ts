import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NurseApproval, NurseApprovalSchema } from './nurse-approval.schema';
import { NurseApprovalsService } from './nurse-approvals.service';
import { NurseApprovalsController } from './nurse-approvals.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: NurseApproval.name, schema: NurseApprovalSchema }]),
    AuditModule,
  ],
  controllers: [NurseApprovalsController],
  providers: [NurseApprovalsService],
  exports: [NurseApprovalsService],
})
export class NurseApprovalsModule {}
