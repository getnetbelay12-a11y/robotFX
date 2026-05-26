import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../auth/types';
import { UserRole } from '../users/user.schema';
import { ExpirationRecordsService } from './expiration-records.service';
import { UpdateRenewalStatusDto } from './dto/update-renewal-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('expiration-records')
export class ExpirationRecordsController {
  constructor(private readonly service: ExpirationRecordsService) {}

  @Roles(UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.CARE_COORDINATOR, UserRole.NURSE, UserRole.CAREGIVER)
  @Get()
  list(@CurrentUser() actor: AuthUser) {
    return this.service.list(actor);
  }

  @Roles(UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.CARE_COORDINATOR, UserRole.NURSE)
  @Patch(':id/renewal-status')
  updateRenewalStatus(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateRenewalStatusDto) {
    return this.service.updateRenewalStatus(actor, id, dto);
  }
}
