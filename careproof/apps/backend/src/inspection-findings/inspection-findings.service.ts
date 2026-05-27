import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InspectionRule, InspectionRuleDocument } from './inspection-rule.schema';
import { InspectionFinding, InspectionFindingDocument } from './inspection-finding.schema';
import { UpdateFindingStatusDto } from './dto/update-finding-status.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/types';
import { requirePermission } from '../auth/permissions';
import { requireBranchScope } from '../auth/scope';
import { Client, ClientDocument } from '../clients/client.schema';
import { User, UserDocument } from '../users/user.schema';

export type InspectionFindingResponse = {
  _id: Types.ObjectId;
  agencyId: Types.ObjectId;
  branchId?: Types.ObjectId;
  ruleId: Types.ObjectId;
  title: string;
  severity: string;
  status: string;
  clientId?: Types.ObjectId;
  visitId?: Types.ObjectId;
  caregiverId?: Types.ObjectId;
  clientName?: string;
  caregiverName?: string;
  description?: string;
  assignedTo?: string;
  dueDate?: string;
  resolvedAt?: Date | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

@Injectable()
export class InspectionFindingsService {
  constructor(
    @InjectModel(InspectionRule.name)
    private readonly rulesModel: Model<InspectionRuleDocument>,
    @InjectModel(InspectionFinding.name)
    private readonly findingsModel: Model<InspectionFindingDocument>,
    @InjectModel(Client.name)
    private readonly clientsModel: Model<ClientDocument>,
    @InjectModel(User.name)
    private readonly usersModel: Model<UserDocument>,
    private readonly auditService: AuditService,
  ) {}

  async listRules(actor: AuthUser) {
    requirePermission(actor.role, 'inspection.read');
    return this.rulesModel
      .find({ agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null, active: true })
      .sort({ severity: 1 })
      .lean();
  }

  async listFindings(actor: AuthUser): Promise<InspectionFindingResponse[]> {
    requirePermission(actor.role, 'inspection.read');
    const filter: Record<string, unknown> = {
      agencyId: new Types.ObjectId(actor.agencyId),
      deletedAt: null,
    };
    if (actor.branchId) {
      filter.branchId = new Types.ObjectId(actor.branchId);
    }
    const findings = await this.findingsModel
      .find(filter)
      .sort({ createdAt: -1 })
      .lean() as InspectionFindingResponse[];

    const clientIds = Array.from(new Set(findings.map((finding) => finding.clientId?.toString()).filter(Boolean)));
    const caregiverIds = Array.from(new Set(findings.map((finding) => finding.caregiverId?.toString()).filter(Boolean)));

    const [clients, caregivers] = await Promise.all([
      clientIds.length
        ? this.clientsModel.find({ _id: { $in: clientIds.map((id) => new Types.ObjectId(id)) }, agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null }).lean()
        : [],
      caregiverIds.length
        ? this.usersModel.find({ _id: { $in: caregiverIds.map((id) => new Types.ObjectId(id)) }, agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null }).lean()
        : [],
    ]);

    const clientNameById = new Map(clients.map((client) => [client._id.toString(), `${client.firstName} ${client.lastName}`]));
    const caregiverNameById = new Map(caregivers.map((caregiver) => [caregiver._id.toString(), `${caregiver.firstName} ${caregiver.lastName}`]));

    return findings.map((finding) => ({
      ...finding,
      clientName: finding.clientId ? clientNameById.get(finding.clientId.toString()) ?? finding.clientName : finding.clientName,
      caregiverName: finding.caregiverId ? caregiverNameById.get(finding.caregiverId.toString()) ?? finding.caregiverName : finding.caregiverName,
    }));
  }

  async updateFindingStatus(actor: AuthUser, id: string, dto: UpdateFindingStatusDto) {
    requirePermission(actor.role, 'inspection.write');
    const update: Record<string, unknown> = { status: dto.status };
    if (dto.status === 'resolved') update.resolvedAt = new Date();
    const existing = await this.findingsModel.findOne({
      _id: new Types.ObjectId(id),
      agencyId: new Types.ObjectId(actor.agencyId),
      deletedAt: null,
    });
    if (!existing) throw new NotFoundException('Inspection finding not found');
    requireBranchScope(existing.branchId, actor);
    const doc = await this.findingsModel.findOneAndUpdate({ _id: existing._id }, update, { new: true });
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
