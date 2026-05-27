import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../auth/types';
import { UserRole } from '../users/user.schema';
import { InspectionFindingResponse, InspectionFindingsService } from './inspection-findings.service';
import { UpdateFindingStatusDto } from './dto/update-finding-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inspection-findings')
export class InspectionFindingsController {
  constructor(private readonly service: InspectionFindingsService) {}

  @Roles(UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.CARE_COORDINATOR, UserRole.NURSE, UserRole.CAREGIVER)
  @Get('rules')
  listRules(@CurrentUser() actor: AuthUser) {
    return this.service.listRules(actor);
  }

  @Roles(UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.CARE_COORDINATOR, UserRole.NURSE, UserRole.CAREGIVER)
  @Get()
  listFindings(@CurrentUser() actor: AuthUser): Promise<InspectionFindingResponse[]> {
    return this.service.listFindings(actor);
  }

  @Roles(UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.CARE_COORDINATOR, UserRole.NURSE)
  @Patch(':id/status')
  updateStatus(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateFindingStatusDto) {
    return this.service.updateFindingStatus(actor, id, dto);
  }
}
