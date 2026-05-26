import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SocialWorkCase, SocialWorkCaseSchema } from './social-work-case.schema';
import { SocialWorkCasesService } from './social-work-cases.service';
import { SocialWorkCasesController } from './social-work-cases.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SocialWorkCase.name, schema: SocialWorkCaseSchema }]),
    AuditModule,
  ],
  controllers: [SocialWorkCasesController],
  providers: [SocialWorkCasesService],
  exports: [SocialWorkCasesService],
})
export class SocialWorkCasesModule {}
