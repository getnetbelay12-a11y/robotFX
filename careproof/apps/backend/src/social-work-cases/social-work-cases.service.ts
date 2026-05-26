import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SocialWorkCase, SocialWorkCaseDocument } from './social-work-case.schema';
import { CreateSocialWorkCaseDto } from './dto/create-social-work-case.dto';
import { UpdateCaseStatusDto } from './dto/update-case-status.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/types';
import { requirePermission } from '../auth/permissions';

@Injectable()
export class SocialWorkCasesService {
  constructor(
    @InjectModel(SocialWorkCase.name)
    private readonly model: Model<SocialWorkCaseDocument>,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: AuthUser) {
    requirePermission(actor.role, 'social_work.read');
    return this.model
      .find({ agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null })
      .sort({ createdAt: -1 })
      .lean();
  }

  async create(actor: AuthUser, dto: CreateSocialWorkCaseDto) {
    requirePermission(actor.role, 'social_work.write');
    const doc = await this.model.create({
      ...dto,
      clientId: dto.clientId ? new Types.ObjectId(dto.clientId) : undefined,
      agencyId: new Types.ObjectId(actor.agencyId),
      status: 'active',
    });
    await this.auditService.log({
      agencyId: new Types.ObjectId(actor.agencyId),
      actorUserId: new Types.ObjectId(actor.sub),
      action: 'SOCIAL_WORK_CASE_CREATED',
      entityType: 'social_work_case',
      entityId: (doc as any)._id.toString(),
    });
    return doc;
  }

  async updateStatus(actor: AuthUser, id: string, dto: UpdateCaseStatusDto) {
    requirePermission(actor.role, 'social_work.write');
    const doc = await this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(id), agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null },
      { status: dto.status },
      { new: true },
    );
    if (!doc) throw new NotFoundException('Social work case not found');
    await this.auditService.log({
      agencyId: new Types.ObjectId(actor.agencyId),
      actorUserId: new Types.ObjectId(actor.sub),
      action: `SOCIAL_WORK_CASE_${dto.status.toUpperCase()}`,
      entityType: 'social_work_case',
      entityId: id,
    });
    return doc;
  }
}
