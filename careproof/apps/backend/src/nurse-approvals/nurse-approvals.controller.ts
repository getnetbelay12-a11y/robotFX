import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../auth/types';
import { UserRole } from '../users/user.schema';
import { NurseApprovalsService } from './nurse-approvals.service';
import { CreateNurseApprovalDto } from './dto/create-nurse-approval.dto';
import { DecideNurseApprovalDto } from './dto/decide-nurse-approval.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('nurse-approvals')
export class NurseApprovalsController {
  constructor(private readonly service: NurseApprovalsService) {}

  @Roles(UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.CARE_COORDINATOR, UserRole.NURSE, UserRole.CAREGIVER)
  @Get()
  list(@CurrentUser() actor: AuthUser) {
    return this.service.list(actor);
  }

  @Roles(UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.CARE_COORDINATOR, UserRole.NURSE)
  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateNurseApprovalDto) {
    return this.service.create(actor, dto);
  }

  @Roles(UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.CARE_COORDINATOR, UserRole.NURSE, UserRole.CAREGIVER)
  @Get(':id')
  findOne(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.service.findOne(actor, id);
  }

  @Roles(UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.NURSE)
  @Patch(':id/decide')
  decide(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: DecideNurseApprovalDto) {
    return this.service.decide(actor, id, dto);
  }
}
