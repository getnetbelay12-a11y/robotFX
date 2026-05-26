import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NurseApproval, NurseApprovalDocument } from './nurse-approval.schema';
import { CreateNurseApprovalDto } from './dto/create-nurse-approval.dto';
import { DecideNurseApprovalDto } from './dto/decide-nurse-approval.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/types';
import { requirePermission } from '../auth/permissions';

@Injectable()
export class NurseApprovalsService {
  constructor(
    @InjectModel(NurseApproval.name)
    private readonly model: Model<NurseApprovalDocument>,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: AuthUser) {
    requirePermission(actor.role, 'nurse_approval.read');
    return this.model
      .find({ agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null })
      .sort({ createdAt: -1 })
      .lean();
  }

  async create(actor: AuthUser, dto: CreateNurseApprovalDto) {
    requirePermission(actor.role, 'nurse_approval.write');
    const doc = await this.model.create({
      ...dto,
      visitId: new Types.ObjectId(dto.visitId),
      agencyId: new Types.ObjectId(actor.agencyId),
      status: 'pending_review',
    });
    await this.auditService.log({
      agencyId: new Types.ObjectId(actor.agencyId),
      actorUserId: new Types.ObjectId(actor.sub),
      action: 'NURSE_APPROVAL_CREATED',
      entityType: 'nurse_approval',
      entityId: (doc as any)._id.toString(),
    });
    return doc;
  }

  async findOne(actor: AuthUser, id: string) {
    requirePermission(actor.role, 'nurse_approval.read');
    const doc = await this.model
      .findOne({ _id: new Types.ObjectId(id), agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null })
      .lean();
    if (!doc) throw new NotFoundException('Nurse approval not found');
    return doc;
  }

  async decide(actor: AuthUser, id: string, dto: DecideNurseApprovalDto) {
    requirePermission(actor.role, 'nurse_approval.write');
    const doc = await this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(id), agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null },
      {
        status: dto.decision,
        nurseNotes: dto.nurseNotes,
        reviewedBy: new Types.ObjectId(actor.sub),
        reviewedAt: new Date(),
      },
      { new: true },
    );
    if (!doc) throw new NotFoundException('Nurse approval not found');
    await this.auditService.log({
      agencyId: new Types.ObjectId(actor.agencyId),
      actorUserId: new Types.ObjectId(actor.sub),
      action: `NURSE_APPROVAL_${dto.decision.toUpperCase()}`,
      entityType: 'nurse_approval',
      entityId: id,
    });
    return doc;
  }
}
