import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../auth/types';
import { UserRole } from '../users/user.schema';
import { MedicalAvailabilityService } from './medical-availability.service';
import { UpdateAvailabilityStatusDto } from './dto/update-availability-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('medical-availability')
export class MedicalAvailabilityController {
  constructor(private readonly service: MedicalAvailabilityService) {}

  @Roles(UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.CARE_COORDINATOR, UserRole.NURSE, UserRole.CAREGIVER)
  @Get()
  list(@CurrentUser() actor: AuthUser) {
    return this.service.list(actor);
  }

  @Roles(UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.CARE_COORDINATOR, UserRole.NURSE)
  @Patch(':id/status')
  updateStatus(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateAvailabilityStatusDto) {
    return this.service.updateStatus(actor, id, dto);
  }
}
