import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../auth/types';
import { InspectionFindingsService } from './inspection-findings.service';
import { UpdateFindingStatusDto } from './dto/update-finding-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inspection-findings')
export class InspectionFindingsController {
  constructor(private readonly service: InspectionFindingsService) {}

  @Get('rules')
  listRules(@CurrentUser() actor: AuthUser) {
    return this.service.listRules(actor);
  }

  @Get()
  listFindings(@CurrentUser() actor: AuthUser) {
    return this.service.listFindings(actor);
  }

  @Patch(':id/status')
  updateStatus(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateFindingStatusDto) {
    return this.service.updateFindingStatus(actor, id, dto);
  }
}
