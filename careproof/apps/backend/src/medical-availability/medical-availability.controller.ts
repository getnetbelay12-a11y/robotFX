import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../auth/types';
import { MedicalAvailabilityService } from './medical-availability.service';
import { UpdateAvailabilityStatusDto } from './dto/update-availability-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('medical-availability')
export class MedicalAvailabilityController {
  constructor(private readonly service: MedicalAvailabilityService) {}

  @Get()
  list(@CurrentUser() actor: AuthUser) {
    return this.service.list(actor);
  }

  @Patch(':id/status')
  updateStatus(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateAvailabilityStatusDto) {
    return this.service.updateStatus(actor, id, dto);
  }
}
