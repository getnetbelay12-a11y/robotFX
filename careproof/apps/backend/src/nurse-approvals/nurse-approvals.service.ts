import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NurseApproval, NurseApprovalDocument } from './nurse-approval.schema';
import { CreateNurseApprovalDto } from './dto/create-nurse-approval.dto';
import { DecideNurseApprovalDto } from './dto/decide-nurse-approval.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/types';
import { requirePermission } from '../auth/permissions';
import { canAccessNurseApproval, requireBranchScope } from '../auth/scope';
import { UserRole } from '../users/user.schema';

@Injectable()
export class NurseApprovalsService {
  constructor(
    @InjectModel(NurseApproval.name)
    private readonly model: Model<NurseApprovalDocument>,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: AuthUser) {
    requirePermission(actor.role, 'nurse_approval.read');
    const filter: Record<string, unknown> = {
      agencyId: new Types.ObjectId(actor.agencyId),
      deletedAt: null,
    };
    if (actor.role === UserRole.CAREGIVER) {
      // CAREGIVERs only see approvals for their own visits
      filter.caregiverId = new Types.ObjectId(actor.sub);
    } else if (actor.role === UserRole.NURSE) {
      // NURSEs see pending records they can pick up, plus records they've reviewed
      filter.$or = [
        { status: 'pending_review', reviewedBy: null },
        { reviewedBy: new Types.ObjectId(actor.sub) },
      ];
    }
    if (actor.branchId) {
      filter.branchId = new Types.ObjectId(actor.branchId);
    }
    return this.model.find(filter).sort({ createdAt: -1 }).lean();
  }

  async create(actor: AuthUser, dto: CreateNurseApprovalDto) {
    requirePermission(actor.role, 'nurse_approval.write');
    const doc = await this.model.create({
      ...dto,
      visitId: new Types.ObjectId(dto.visitId),
      caregiverId: dto.caregiverId ? new Types.ObjectId(dto.caregiverId) : null,
      branchId: dto.branchId ? new Types.ObjectId(dto.branchId) : actor.branchId ? new Types.ObjectId(actor.branchId) : undefined,
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
    requireBranchScope(doc.branchId, actor);
    if (!canAccessNurseApproval(actor, doc.caregiverId, doc.reviewedBy)) {
      throw new ForbiddenException('You do not have access to this nurse approval');
    }
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
    requireBranchScope(doc.branchId, actor);
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
