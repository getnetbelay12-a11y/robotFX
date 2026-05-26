import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InspectionRule, InspectionRuleDocument } from './inspection-rule.schema';
import { InspectionFinding, InspectionFindingDocument } from './inspection-finding.schema';
import { UpdateFindingStatusDto } from './dto/update-finding-status.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/types';
import { requirePermission } from '../auth/permissions';

@Injectable()
export class InspectionFindingsService {
  constructor(
    @InjectModel(InspectionRule.name)
    private readonly rulesModel: Model<InspectionRuleDocument>,
    @InjectModel(InspectionFinding.name)
    private readonly findingsModel: Model<InspectionFindingDocument>,
    private readonly auditService: AuditService,
  ) {}

  async listRules(actor: AuthUser) {
    requirePermission(actor.role, 'inspection.read');
    return this.rulesModel
      .find({ agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null, active: true })
      .sort({ severity: 1 })
      .lean();
  }

  async listFindings(actor: AuthUser) {
    requirePermission(actor.role, 'inspection.read');
    return this.findingsModel
      .find({ agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null })
      .sort({ createdAt: -1 })
      .lean();
  }

  async updateFindingStatus(actor: AuthUser, id: string, dto: UpdateFindingStatusDto) {
    requirePermission(actor.role, 'inspection.write');
    const update: Record<string, unknown> = { status: dto.status };
    if (dto.status === 'resolved') update.resolvedAt = new Date();
    const doc = await this.findingsModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null },
      update,
      { new: true },
    );
    if (!doc) throw new NotFoundException('Inspection finding not found');
    await this.auditService.log({
      agencyId: new Types.ObjectId(actor.agencyId),
      actorUserId: new Types.ObjectId(actor.sub),
      action: `INSPECTION_FINDING_${dto.status.toUpperCase()}`,
      entityType: 'inspection_finding',
      entityId: id,
    });
    return doc;
  }
}
