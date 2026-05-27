import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../auth/types';
import { UserRole } from '../users/user.schema';
import { MedicationsService } from './medications.service';
import { CreateMedicationRecordDto } from './dto/create-medication-record.dto';
import { ReconcileMedicationDto } from './dto/reconcile-medication.dto';
import { RequestNurseReviewDto } from './dto/request-nurse-review.dto';
import { UpdateMedicationQuantityDto } from './dto/update-medication-quantity.dto';
import { UpdateMedicationStatusDto } from './dto/update-medication-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('medications')
export class MedicationsController {
  constructor(private readonly service: MedicationsService) {}

  @Roles(UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.CARE_COORDINATOR, UserRole.NURSE, UserRole.INTAKE_AGENT, UserRole.CAREGIVER, UserRole.FAMILY_MEMBER)
  @Get()
  list(@CurrentUser() actor: AuthUser) {
    return this.service.list(actor);
  }

  @Roles(UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.CARE_COORDINATOR, UserRole.NURSE, UserRole.INTAKE_AGENT, UserRole.CAREGIVER, UserRole.FAMILY_MEMBER)
  @Get(':id')
  findOne(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.service.findOne(actor, id);
  }

  @Roles(UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.CARE_COORDINATOR, UserRole.NURSE)
  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateMedicationRecordDto) {
    return this.service.create(actor, dto);
  }

  @Roles(UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.CARE_COORDINATOR, UserRole.NURSE)
  @Patch(':id/status')
  updateStatus(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateMedicationStatusDto) {
    return this.service.updateStatus(actor, id, dto);
  }

  @Roles(UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.CARE_COORDINATOR, UserRole.NURSE)
  @Patch(':id/reconcile')
  reconcile(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: ReconcileMedicationDto) {
    return this.service.reconcile(actor, id, dto);
  }

  @Roles(UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.CARE_COORDINATOR, UserRole.NURSE)
  @Patch(':id/quantity')
  updateQuantity(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateMedicationQuantityDto) {
    return this.service.updateQuantity(actor, id, dto);
  }

  @Roles(UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.CARE_COORDINATOR, UserRole.NURSE)
  @Patch(':id/nurse-review')
  requestNurseReview(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: RequestNurseReviewDto) {
    return this.service.requestNurseReview(actor, id, dto);
  }
}
