import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { AgenciesModule } from './agencies/agencies.module';
import { ClientsModule } from './clients/clients.module';
import configuration, { validateEnv } from './config/configuration';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { FamilyModule } from './family/family.module';
import { HealthModule } from './health/health.module';
import { IncidentsModule } from './incidents/incidents.module';
import { ImportsModule } from './imports/imports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { AiModule } from './modules/ai/ai.module';
import { UsersModule } from './users/users.module';
import { VisitsModule } from './visits/visits.module';
import { RequestLoggingMiddleware } from './common/request-logging.middleware';
import { DemoModule } from './demo/demo.module';
import { DemoRequestsModule } from './demo-requests/demo-requests.module';
import { SystemModule } from './system/system.module';
import { NurseApprovalsModule } from './nurse-approvals/nurse-approvals.module';
import { InspectionFindingsModule } from './inspection-findings/inspection-findings.module';
import { SocialWorkCasesModule } from './social-work-cases/social-work-cases.module';
import { IntakeRecordsModule } from './intake-records/intake-records.module';
import { MedicalAvailabilityModule } from './medical-availability/medical-availability.module';
import { ExpirationRecordsModule } from './expiration-records/expiration-records.module';
import { MedicationsModule } from './medications/medications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [configuration],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 30,
      },
    ]),
    MongooseModule.forRootAsync(DatabaseModule.connectionFactory()),
    AuthModule,
    AgenciesModule,
    AuditModule,
    UsersModule,
    ClientsModule,
    VisitsModule,
    IncidentsModule,
    ImportsModule,
    FamilyModule,
    NotificationsModule,
    AiModule,
    DashboardModule,
    ReportsModule,
    HealthModule,
    DemoModule,
    DemoRequestsModule,
    SystemModule,
    NurseApprovalsModule,
    InspectionFindingsModule,
    SocialWorkCasesModule,
    IntakeRecordsModule,
    MedicalAvailabilityModule,
    ExpirationRecordsModule,
    MedicationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
