import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../auth/types';
import { IntakeRecordsService } from './intake-records.service';
import { CreateIntakeRecordDto } from './dto/create-intake-record.dto';
import { UpdateIntakeStageDto } from './dto/update-intake-stage.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('intake-records')
export class IntakeRecordsController {
  constructor(private readonly service: IntakeRecordsService) {}

  @Get()
  list(@CurrentUser() actor: AuthUser) {
    return this.service.list(actor);
  }

  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateIntakeRecordDto) {
    return this.service.create(actor, dto);
  }

  @Patch(':id/stage')
  updateStage(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateIntakeStageDto) {
    return this.service.updateStage(actor, id, dto);
  }
}
