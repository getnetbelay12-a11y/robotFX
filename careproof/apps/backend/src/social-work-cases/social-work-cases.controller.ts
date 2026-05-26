import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AuthUser } from '../auth/types';
import { SocialWorkCasesService } from './social-work-cases.service';
import { CreateSocialWorkCaseDto } from './dto/create-social-work-case.dto';
import { UpdateCaseStatusDto } from './dto/update-case-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('social-work-cases')
export class SocialWorkCasesController {
  constructor(private readonly service: SocialWorkCasesService) {}

  @Get()
  list(@CurrentUser() actor: AuthUser) {
    return this.service.list(actor);
  }

  @Post()
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateSocialWorkCaseDto) {
    return this.service.create(actor, dto);
  }

  @Patch(':id/status')
  updateStatus(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: UpdateCaseStatusDto) {
    return this.service.updateStatus(actor, id, dto);
  }
}
