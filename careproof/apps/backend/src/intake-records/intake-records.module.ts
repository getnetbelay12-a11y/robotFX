import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IntakeRecord, IntakeRecordSchema } from './intake-record.schema';
import { IntakeRecordsService } from './intake-records.service';
import { IntakeRecordsController } from './intake-records.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: IntakeRecord.name, schema: IntakeRecordSchema }]),
    AuditModule,
  ],
  controllers: [IntakeRecordsController],
  providers: [IntakeRecordsService],
  exports: [IntakeRecordsService],
})
export class IntakeRecordsModule {}
