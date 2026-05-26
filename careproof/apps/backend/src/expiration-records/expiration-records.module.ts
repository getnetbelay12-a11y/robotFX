import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExpirationRecord, ExpirationRecordSchema } from './expiration-record.schema';
import { ExpirationRecordsService } from './expiration-records.service';
import { ExpirationRecordsController } from './expiration-records.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ExpirationRecord.name, schema: ExpirationRecordSchema }]),
    AuditModule,
  ],
  controllers: [ExpirationRecordsController],
  providers: [ExpirationRecordsService],
  exports: [ExpirationRecordsService],
})
export class ExpirationRecordsModule {}
