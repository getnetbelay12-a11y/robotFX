import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MedicationRecord, MedicationRecordDocument } from './medication-record.schema';
import { CreateMedicationRecordDto } from './dto/create-medication-record.dto';
import { ReconcileMedicationDto } from './dto/reconcile-medication.dto';
import { RequestNurseReviewDto } from './dto/request-nurse-review.dto';
import { UpdateMedicationQuantityDto } from './dto/update-medication-quantity.dto';
import { UpdateMedicationStatusDto } from './dto/update-medication-status.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/types';
import { requirePermission } from '../auth/permissions';
import { requireBranchScope } from '../auth/scope';
import { UserRole } from '../users/user.schema';
import { Client, ClientDocument } from '../clients/client.schema';
import { Visit, VisitDocument } from '../visits/visit.schema';
import { MedicalAvailability, MedicalAvailabilityDocument } from '../medical-availability/medical-availability.schema';
import { ExpirationRecord, ExpirationRecordDocument } from '../expiration-records/expiration-record.schema';
import { InspectionFinding, InspectionFindingDocument } from '../inspection-findings/inspection-finding.schema';
import { InspectionRule, InspectionRuleDocument } from '../inspection-findings/inspection-rule.schema';
import { NurseApproval, NurseApprovalDocument } from '../nurse-approvals/nurse-approval.schema';
import { Notification, NotificationDocument, NotificationStatus } from '../family/notification.schema';

const BLOCKING_STATUSES = new Set(['Missing', 'Low Stock', 'Expired', 'Order Expired', 'Needs Nurse Review', 'Needs Refill']);

type MedicationResponse = MedicationRecord & {
  _id: Types.ObjectId;
  clientName?: string;
};

@Injectable()
export class MedicationsService {
  constructor(
    @InjectModel(MedicationRecord.name)
    private readonly medicationModel: Model<MedicationRecordDocument>,
    @InjectModel(Client.name)
    private readonly clientModel: Model<ClientDocument>,
    @InjectModel(Visit.name)
    private readonly visitModel: Model<VisitDocument>,
    @InjectModel(MedicalAvailability.name)
    private readonly availabilityModel: Model<MedicalAvailabilityDocument>,
    @InjectModel(ExpirationRecord.name)
    private readonly expirationModel: Model<ExpirationRecordDocument>,
    @InjectModel(InspectionFinding.name)
    private readonly findingModel: Model<InspectionFindingDocument>,
    @InjectModel(InspectionRule.name)
    private readonly ruleModel: Model<InspectionRuleDocument>,
    @InjectModel(NurseApproval.name)
    private readonly nurseApprovalModel: Model<NurseApprovalDocument>,
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: AuthUser): Promise<MedicationResponse[]> {
    requirePermission(actor.role, 'medication.read');
    const filter = await this.buildAccessFilter(actor);
    const records = await this.medicationModel.find(filter).sort({ status: 1, medicationExpiryDate: 1 }).lean();
    return this.withClientNames(records as MedicationResponse[], actor);
  }

  async findOne(actor: AuthUser, id: string): Promise<MedicationResponse> {
    requirePermission(actor.role, 'medication.read');
    const record = await this.medicationModel
      .findOne({ _id: new Types.ObjectId(id), agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null })
      .lean() as MedicationResponse | null;
    if (!record) throw new NotFoundException('Medication record not found');
    await this.assertRecordAccess(actor, record);
    const [withName] = await this.withClientNames([record], actor);
    return withName;
  }

  async create(actor: AuthUser, dto: CreateMedicationRecordDto) {
    requirePermission(actor.role, 'medication.write');
    const branchId = new Types.ObjectId(dto.branchId);
    requireBranchScope(branchId, actor);
    const doc = await this.medicationModel.create({
      ...dto,
      agencyId: new Types.ObjectId(actor.agencyId),
      branchId,
      clientId: new Types.ObjectId(dto.clientId),
      visitId: dto.visitId ? new Types.ObjectId(dto.visitId) : null,
      carePlanId: dto.carePlanId ? new Types.ObjectId(dto.carePlanId) : null,
      isHighRisk: dto.isHighRisk ?? false,
      requiresNurseReview: dto.requiresNurseReview ?? false,
      familyVisible: dto.familyVisible ?? false,
      deletedAt: null,
    });
    await this.syncRisks(actor, doc);
    await this.audit(actor, 'MEDICATION_CREATED', doc.id);
    return this.findOne(actor, doc.id);
  }

  async updateStatus(actor: AuthUser, id: string, dto: UpdateMedicationStatusDto) {
    requirePermission(actor.role, 'medication.write');
    const doc = await this.getWritableRecord(actor, id);
    doc.status = dto.status;
    if (dto.notes !== undefined) doc.notes = dto.notes;
    if (['Needs Nurse Review', 'Held'].includes(dto.status) || doc.isHighRisk) {
      doc.requiresNurseReview = true;
    }
    await doc.save();
    await this.syncRisks(actor, doc);
    await this.audit(actor, `MEDICATION_STATUS_${dto.status.toUpperCase().replace(/\s+/g, '_')}`, id);
    return this.findOne(actor, id);
  }

  async reconcile(actor: AuthUser, id: string, dto: ReconcileMedicationDto) {
    requirePermission(actor.role, 'medication.write');
    const doc = await this.getWritableRecord(actor, id);
    doc.lastReconciledAt = dto.lastReconciledAt ?? new Date().toISOString().split('T')[0];
    doc.nextReconciliationDue = dto.nextReconciliationDue;
    if (dto.notes !== undefined) doc.notes = dto.notes;
    if (doc.status === 'Needs Nurse Review' && !doc.isHighRisk) {
      doc.status = doc.quantityAvailable <= doc.minimumRequiredQuantity ? 'Low Stock' : 'Available';
    }
    await doc.save();
    await this.syncRisks(actor, doc);
    await this.audit(actor, 'MEDICATION_RECONCILED', id);
    return this.findOne(actor, id);
  }

  async updateQuantity(actor: AuthUser, id: string, dto: UpdateMedicationQuantityDto) {
    requirePermission(actor.role, 'medication.write');
    const doc = await this.getWritableRecord(actor, id);
    doc.quantityAvailable = dto.quantityAvailable;
    if (dto.notes !== undefined) doc.notes = dto.notes;
    if (doc.quantityAvailable <= 0) {
      doc.status = 'Missing';
    } else if (doc.quantityAvailable <= doc.minimumRequiredQuantity) {
      doc.status = 'Low Stock';
    } else if (doc.status === 'Low Stock' || doc.status === 'Missing') {
      doc.status = 'Available';
    }
    await doc.save();
    await this.syncRisks(actor, doc);
    await this.audit(actor, 'MEDICATION_QUANTITY_UPDATED', id);
    return this.findOne(actor, id);
  }

  async requestNurseReview(actor: AuthUser, id: string, dto: RequestNurseReviewDto) {
    requirePermission(actor.role, 'medication.write');
    const doc = await this.getWritableRecord(actor, id);
    doc.requiresNurseReview = true;
    doc.status = 'Needs Nurse Review';
    if (dto.notes !== undefined) doc.notes = dto.notes;
    await doc.save();
    await this.ensureNurseApproval(actor, doc);
    await this.syncRisks(actor, doc);
    await this.audit(actor, 'MEDICATION_NURSE_REVIEW_REQUESTED', id);
    return this.findOne(actor, id);
  }

  private async buildAccessFilter(actor: AuthUser) {
    const filter: Record<string, unknown> = {
      agencyId: new Types.ObjectId(actor.agencyId),
      deletedAt: null,
    };
    if (actor.branchId) filter.branchId = new Types.ObjectId(actor.branchId);
    if (actor.role === UserRole.CAREGIVER) {
      const visits = await this.visitModel.find({
        agencyId: new Types.ObjectId(actor.agencyId),
        caregiverId: new Types.ObjectId(actor.sub),
        deletedAt: null,
      }).select('_id clientId').lean();
      filter.$or = [
        { visitId: { $in: visits.map((visit) => visit._id) } },
        { clientId: { $in: visits.map((visit) => visit.clientId) } },
      ];
    }
    if (actor.role === UserRole.FAMILY_MEMBER) {
      const clients = await this.clientModel.find({
        agencyId: new Types.ObjectId(actor.agencyId),
        familyMemberIds: new Types.ObjectId(actor.sub),
        deletedAt: null,
      }).select('_id').lean();
      filter.clientId = { $in: clients.map((client) => client._id) };
      filter.familyVisible = true;
    }
    return filter;
  }

  private async assertRecordAccess(actor: AuthUser, record: MedicationResponse) {
    requireBranchScope(record.branchId, actor);
    if (actor.role === UserRole.FAMILY_MEMBER && !record.familyVisible) {
      throw new ForbiddenException('Medication record is not family visible.');
    }
    if (actor.role === UserRole.CAREGIVER) {
      const assignedVisit = record.visitId
        ? await this.visitModel.exists({ _id: record.visitId, agencyId: record.agencyId, caregiverId: new Types.ObjectId(actor.sub), deletedAt: null })
        : null;
      const assignedClient = await this.visitModel.exists({ clientId: record.clientId, agencyId: record.agencyId, caregiverId: new Types.ObjectId(actor.sub), deletedAt: null });
      if (!assignedVisit && !assignedClient) {
        throw new ForbiddenException('Medication record is not assigned to this caregiver.');
      }
    }
  }

  private async getWritableRecord(actor: AuthUser, id: string) {
    const doc = await this.medicationModel.findOne({
      _id: new Types.ObjectId(id),
      agencyId: new Types.ObjectId(actor.agencyId),
      deletedAt: null,
    });
    if (!doc) throw new NotFoundException('Medication record not found');
    requireBranchScope(doc.branchId, actor);
    return doc;
  }

  private async withClientNames(records: MedicationResponse[], actor: AuthUser) {
    const clientIds = Array.from(new Set(records.map((record) => record.clientId.toString())));
    const clients = clientIds.length
      ? await this.clientModel.find({ _id: { $in: clientIds.map((id) => new Types.ObjectId(id)) }, agencyId: new Types.ObjectId(actor.agencyId) }).lean()
      : [];
    const names = new Map(clients.map((client) => [client._id.toString(), `${client.firstName} ${client.lastName}`]));
    return records.map((record) => ({
      ...record,
      notes: actor.role === UserRole.FAMILY_MEMBER || actor.role === UserRole.CAREGIVER ? undefined : record.notes,
      clientName: names.get(record.clientId.toString()) ?? 'Client',
    }));
  }

  private async syncRisks(actor: AuthUser, medication: MedicationRecordDocument) {
    await Promise.all([
      this.ensureMedicalAvailability(actor, medication),
      this.ensureExpirationRecords(medication),
      this.ensureInspectionFindings(medication),
      medication.requiresNurseReview || medication.isHighRisk || medication.status === 'Needs Nurse Review'
        ? this.ensureNurseApproval(actor, medication)
        : Promise.resolve(),
    ]);
  }

  private async ensureMedicalAvailability(actor: AuthUser, medication: MedicationRecordDocument) {
    if (!BLOCKING_STATUSES.has(medication.status)) return;
    const client = await this.clientModel.findById(medication.clientId).lean();
    await this.availabilityModel.findOneAndUpdate(
      { agencyId: medication.agencyId, sourceMedicationId: medication._id, deletedAt: null },
      {
        agencyId: medication.agencyId,
        branchId: medication.branchId,
        clientId: medication.clientId,
        visitId: medication.visitId,
        sourceMedicationId: medication._id,
        clientName: client ? `${client.firstName} ${client.lastName}` : 'Client',
        serviceType: `Medication: ${medication.medicationName}`,
        status: 'unavailable',
        scheduledDate: new Date().toISOString().split('T')[0],
        providerName: 'Medication Management',
        notes: `${medication.status}: ${medication.medicationName} ${medication.strength}. ${medication.notes ?? ''}`.trim(),
        deletedAt: null,
      },
      { upsert: true, new: true },
    );
    await this.notificationModel.create({
      agencyId: medication.agencyId,
      type: 'medication_blocker',
      channel: 'push',
      audience: 'agency',
      subject: `Medication blocker: ${medication.medicationName}`,
      message: `${medication.medicationName} is ${medication.status}. Human review required before visit readiness is cleared.`,
      status: NotificationStatus.QUEUED,
      recipient: '',
      metadata: { medicationId: medication._id.toString(), actorUserId: actor.sub },
    });
  }

  private async ensureExpirationRecords(medication: MedicationRecordDocument) {
    const client = await this.clientModel.findById(medication.clientId).lean();
    const ownerName = client ? `${client.firstName} ${client.lastName}` : 'Client';
    await Promise.all([
      this.expirationModel.findOneAndUpdate(
        { agencyId: medication.agencyId, sourceMedicationId: medication._id, documentType: `Medication Expiration: ${medication.medicationName}`, deletedAt: null },
        {
          agencyId: medication.agencyId,
          caregiverName: ownerName,
          caregiverId: medication.clientId,
          sourceMedicationId: medication._id,
          documentType: `Medication Expiration: ${medication.medicationName}`,
          expiryDate: medication.medicationExpiryDate,
          status: medication.status === 'Expired' ? 'expired' : 'expiring_soon',
          renewalSubmittedAt: null,
          deletedAt: null,
        },
        { upsert: true },
      ),
      this.expirationModel.findOneAndUpdate(
        { agencyId: medication.agencyId, sourceMedicationId: medication._id, documentType: `Medication Order: ${medication.medicationName}`, deletedAt: null },
        {
          agencyId: medication.agencyId,
          caregiverName: ownerName,
          caregiverId: medication.clientId,
          sourceMedicationId: medication._id,
          documentType: `Medication Order: ${medication.medicationName}`,
          expiryDate: medication.orderExpiryDate,
          status: medication.status === 'Order Expired' ? 'expired' : 'expiring_soon',
          renewalSubmittedAt: null,
          deletedAt: null,
        },
        { upsert: true },
      ),
    ]);
  }

  private async ensureInspectionFindings(medication: MedicationRecordDocument) {
    const risks = this.medicationRiskTitles(medication);
    if (!risks.length) return;
    const rule = await this.ruleModel.findOneAndUpdate(
      { agencyId: medication.agencyId, ruleCode: 'MED-001' },
      {
        agencyId: medication.agencyId,
        ruleCode: 'MED-001',
        description: 'Medication records must be available, current, reconciled, and nurse-reviewed when high risk.',
        severity: 'critical',
        category: 'Medication',
        active: true,
        deletedAt: null,
      },
      { upsert: true, new: true },
    );
    const client = await this.clientModel.findById(medication.clientId).lean();
    await Promise.all(risks.map((risk) => this.findingModel.findOneAndUpdate(
      { agencyId: medication.agencyId, sourceMedicationId: medication._id, title: risk.title, deletedAt: null },
      {
        agencyId: medication.agencyId,
        branchId: medication.branchId,
        ruleId: rule._id,
        sourceMedicationId: medication._id,
        title: risk.title,
        severity: risk.severity,
        status: 'open',
        clientId: medication.clientId,
        visitId: medication.visitId,
        clientName: client ? `${client.firstName} ${client.lastName}` : 'Client',
        description: risk.description,
        assignedTo: risk.owner,
        dueDate: new Date().toISOString().split('T')[0],
        resolvedAt: null,
        deletedAt: null,
      },
      { upsert: true },
    )));
  }

  private async ensureNurseApproval(actor: AuthUser, medication: MedicationRecordDocument) {
    if (medication.nurseApprovalId) return;
    const client = await this.clientModel.findById(medication.clientId).lean();
    const doc = await this.nurseApprovalModel.create({
      agencyId: medication.agencyId,
      branchId: medication.branchId,
      visitId: medication.visitId ?? new Types.ObjectId(),
      caregiverId: null,
      clientName: client ? `${client.firstName} ${client.lastName}` : 'Client',
      caregiverName: 'Medication Management',
      visitDate: new Date().toISOString().split('T')[0],
      visitType: `Medication review: ${medication.medicationName}`,
      priority: medication.isHighRisk ? 'critical' : 'high',
      status: 'pending_review',
      nurseNotes: medication.notes ?? `${medication.medicationName} requires medication nurse review.`,
      reviewedBy: null,
      reviewedAt: null,
      deletedAt: null,
    });
    medication.nurseApprovalId = doc._id as Types.ObjectId;
    await medication.save();
    await this.audit(actor, 'MEDICATION_NURSE_APPROVAL_CREATED', doc.id);
  }

  private medicationRiskTitles(medication: MedicationRecordDocument) {
    const today = new Date().toISOString().split('T')[0];
    const risks: Array<{ title: string; severity: string; description: string; owner: string }> = [];
    if (medication.status === 'Expired' || medication.medicationExpiryDate < today) {
      risks.push({ title: 'Medication expired', severity: 'critical', description: `${medication.medicationName} expired on ${medication.medicationExpiryDate}.`, owner: 'Nurse' });
    }
    if (medication.status === 'Order Expired' || medication.orderExpiryDate < today) {
      risks.push({ title: 'Medication order expired', severity: 'critical', description: `${medication.medicationName} order expired on ${medication.orderExpiryDate}.`, owner: 'Nurse' });
    }
    if (medication.status === 'Low Stock' || medication.quantityAvailable <= medication.minimumRequiredQuantity) {
      risks.push({ title: 'Medication low stock', severity: 'high', description: `${medication.medicationName} has ${medication.quantityAvailable} available; minimum is ${medication.minimumRequiredQuantity}.`, owner: 'Coordinator' });
    }
    if (medication.status === 'Missing') {
      risks.push({ title: 'Medication missing', severity: 'critical', description: `${medication.medicationName} is missing.`, owner: 'Coordinator' });
    }
    if (medication.nextReconciliationDue <= today) {
      risks.push({ title: 'Medication reconciliation overdue', severity: 'high', description: `${medication.medicationName} reconciliation is due ${medication.nextReconciliationDue}.`, owner: 'Nurse' });
    }
    if (medication.isHighRisk && (medication.requiresNurseReview || !medication.nurseApprovalId)) {
      risks.push({ title: 'High-risk medication missing nurse review', severity: 'critical', description: `${medication.medicationName} is high risk and needs nurse review.`, owner: 'Nurse' });
    }
    if (medication.status === 'Needs Nurse Review') {
      risks.push({ title: 'Medication task attempted without valid order', severity: 'critical', description: `${medication.medicationName} cannot be treated as ready until nurse review is complete.`, owner: 'Nurse' });
    }
    return risks;
  }

  private async audit(actor: AuthUser, action: string, entityId: string) {
    await this.auditService.log({
      agencyId: new Types.ObjectId(actor.agencyId),
      actorUserId: new Types.ObjectId(actor.sub),
      action,
      entityType: 'medication_record',
      entityId,
    });
  }
}
