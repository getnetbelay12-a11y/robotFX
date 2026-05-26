import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../auth/types';
import { UserRole } from '../users/user.schema';
import { IntakeRecordsService } from './intake-records.service';
import { CreateIntakeRecordDto } from './dto/create-intake-record.dto';
import { UpdateIntakeStageDto } from './dto/update-intake-stage.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('intake-records')
export class IntakeRecordsController {
  constructor(private readonly service: IntakeRecordsService) {}

  @Roles(UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.CARE_COORDINATOR, UserRole.INTAKE_AGENT)
  @Get()
  list(@CurrentUser() actor: AuthUser) {
    return this.service.list(actor);
  }

  @Roles(UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.CARE_COORDINATOR, UserRole.INTAKE_AGENT)
  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateIntakeRecordDto) {
    return this.service.create(actor, dto);
  }

  @Roles(UserRole.AGENCY_OWNER, UserRole.AGENCY_ADMIN, UserRole.CARE_COORDINATOR, UserRole.INTAKE_AGENT)
  @Patch(':id/stage')
  updateStage(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateIntakeStageDto) {
    return this.service.updateStage(actor, id, dto);
  }
}
