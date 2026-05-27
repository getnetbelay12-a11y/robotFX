import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { requirePermission } from '../auth/permissions';
import { canAccessClient, canAccessFamilyConcern } from '../auth/scope';
import { AuthUser } from '../auth/types';
import { ClientsService } from '../clients/clients.service';
import { buildNotificationTemplate } from '../notifications/notifications.templates';
import { NotificationsService } from '../notifications/notifications.service';
import { Visit, VisitDocument } from '../visits/visit.schema';
import { CreateFamilyConcernDto } from './dto/create-family-concern.dto';
import { UpdateFamilyConcernDto } from './dto/update-family-concern.dto';
import { FamilyConcern, FamilyConcernDocument } from './family-concern.schema';
import { WeeklyReport, WeeklyReportDocument } from '../reports/weekly-report.schema';

@Injectable()
export class FamilyService {
  constructor(
    @InjectModel(FamilyConcern.name) private readonly concernModel: Model<FamilyConcernDocument>,
    @InjectModel(Visit.name) private readonly visitModel: Model<VisitDocument>,
    @InjectModel(WeeklyReport.name) private readonly weeklyReportModel: Model<WeeklyReportDocument>,
    private readonly clientsService: ClientsService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createConcern(clientId: string, dto: CreateFamilyConcernDto, actor: AuthUser) {
    const client = await this.clientsService.findOne(actor.agencyId, clientId);
    if (!canAccessClient(actor, client.agencyId, client.familyMemberIds ?? [])) {
      throw new ForbiddenException('Family member is not assigned to this client');
    }
    const concern = await this.concernModel.create({
      agencyId: new Types.ObjectId(actor.agencyId),
      clientId: new Types.ObjectId(clientId),
      familyMemberId: new Types.ObjectId(actor.sub),
      ...dto,
    });
    await this.auditService.log({
      agencyId: new Types.ObjectId(actor.agencyId),
      actorUserId: new Types.ObjectId(actor.sub),
      action: 'FAMILY_CONCERN_SUBMITTED',
      entityType: 'familyConcern',
      entityId: concern.id,
      after: concern.toObject() as unknown as Record<string, unknown>,
    });
    const template = buildNotificationTemplate('family_concern_submitted', {
      client: `${client.firstName} ${client.lastName}`,
    });
    await this.notificationsService.queue({
      agencyId: actor.agencyId,
      audience: 'agency',
      channel: 'email',
      recipient: 'agency-alerts@careproof.local',
      type: 'family_concern_submitted',
      subject: template.subject,
      message: template.message,
      actorUserId: actor.sub,
      metadata: { concernId: concern.id, clientId },
    });
    return concern;
  }

  async listConcerns(agencyId: string) {
    return this.concernModel.find({ agencyId: new Types.ObjectId(agencyId) }).sort({ createdAt: -1 }).lean();
  }

  async findConcern(agencyId: string, concernId: string) {
    const concern = await this.concernModel.findOne({
      _id: new Types.ObjectId(concernId),
      agencyId: new Types.ObjectId(agencyId),
    }).lean();
    if (!concern) {
      throw new ForbiddenException('Concern not found for this agency');
    }
    return concern;
  }

  async updateConcern(agencyId: string, concernId: string, dto: UpdateFamilyConcernDto, actor: AuthUser) {
    requirePermission(actor.role, 'family_concern.respond', 'Only agency operators can respond to family concerns.');

    const existing = await this.concernModel
      .findOne({ _id: new Types.ObjectId(concernId), agencyId: new Types.ObjectId(agencyId) })
      .lean();
    if (!existing) {
      throw new ForbiddenException('Concern not found for this agency');
    }
    if (!canAccessFamilyConcern(actor, existing.agencyId, existing.familyMemberId)) {
      throw new ForbiddenException('You do not have access to this family concern.');
    }

    const updates: Record<string, unknown> = {
      assignedTo: new Types.ObjectId(actor.sub),
    };
    if (dto.status?.trim()) {
      updates.status = dto.status.trim();
    }
    if (dto.resolutionNote != null) {
      updates.resolutionNote = dto.resolutionNote.trim();
    }

    const concern = await this.concernModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(concernId), agencyId: new Types.ObjectId(agencyId) },
        updates,
        { new: true },
      )
      .lean();

    await this.auditService.log({
      agencyId: new Types.ObjectId(agencyId),
      actorUserId: new Types.ObjectId(actor.sub),
      action: 'FAMILY_CONCERN_UPDATED',
      entityType: 'familyConcern',
      entityId: concernId,
      after: concern as Record<string, unknown>,
    });

    return concern;
  }

  async familyClients(actor: AuthUser) {
    const clients = await this.clientsService.list(actor.agencyId);
    const assignedClients = clients.filter((client) =>
      (client.familyMemberIds ?? []).some((id: { toString(): string }) => id.toString() === actor.sub),
    );

    const clientIds = assignedClients.map((client) => client._id);
    const [visits, concerns] = await Promise.all([
      clientIds.length
        ? this.visitModel
            .find({
              agencyId: new Types.ObjectId(actor.agencyId),
              clientId: { $in: clientIds },
              deletedAt: null,
            })
            .sort({ scheduledStart: -1 })
            .lean()
        : [],
      clientIds.length
        ? this.concernModel
            .find({
              agencyId: new Types.ObjectId(actor.agencyId),
              clientId: { $in: clientIds },
            })
            .lean()
        : [],
    ]);

    return assignedClients.map((client) => {
      const relatedVisits = visits
        .filter((visit) => visit.clientId.toString() === client._id.toString())
        .sort((left, right) => right.scheduledStart.getTime() - left.scheduledStart.getTime());
      const lastVisit = relatedVisits.find((visit) => ['completed', 'requires_review'].includes(visit.status));
      const nextVisit = relatedVisits
        .filter((visit) => visit.scheduledStart >= new Date())
        .sort((left, right) => left.scheduledStart.getTime() - right.scheduledStart.getTime())[0];
      const openConcerns = concerns.filter(
        (concern) =>
          concern.clientId.toString() === client._id.toString() && !['resolved', 'closed'].includes(concern.status),
      ).length;

      return {
        clientId: client._id,
        firstName: client.firstName,
        lastName: client.lastName,
        status: client.status,
        lastVisit: lastVisit
          ? {
              visitId: lastVisit._id,
              status: lastVisit.status,
              completedAt: lastVisit.actualEnd ?? lastVisit.scheduledEnd,
              summary: lastVisit.familySummary?.text ?? '',
            }
          : null,
        nextVisit: nextVisit
          ? {
              visitId: nextVisit._id,
              scheduledStart: nextVisit.scheduledStart,
              scheduledEnd: nextVisit.scheduledEnd,
            }
          : null,
        openConcerns,
        emergencyContacts: client.emergencyContacts ?? [],
      };
    });
  }

  async familyFeed(clientId: string, actor: AuthUser) {
    const client = await this.clientsService.findOne(actor.agencyId, clientId);
    if (!canAccessClient(actor, client.agencyId, client.familyMemberIds ?? [])) {
      throw new ForbiddenException('Family member is not assigned to this client');
    }
    const visits = await this.visitModel
      .find({
        agencyId: new Types.ObjectId(actor.agencyId),
        clientId: new Types.ObjectId(clientId),
        status: { $in: ['completed', 'requires_review'] },
        deletedAt: null,
      })
      .sort({ scheduledStart: -1 })
      .lean();
    return visits.map((visit) => ({
      id: visit._id,
      scheduledStart: visit.scheduledStart,
      scheduledEnd: visit.scheduledEnd,
      status: visit.status,
      summary: visit.familySummary?.text ?? '',
      timeline: [
        { time: visit.actualStart ?? visit.scheduledStart, label: 'Caregiver arrived' },
        ...visit.tasks
          .filter((task) => task.status === 'done')
          .map((task) => ({ time: task.completedAt ?? visit.actualEnd ?? visit.scheduledEnd, label: `${task.label} completed` })),
        { time: visit.actualEnd ?? visit.scheduledEnd, label: 'Visit completed' },
      ],
    }));
  }

  async familyVisits(clientId: string, actor: AuthUser) {
    return this.familyFeed(clientId, actor);
  }

  async familyReports(clientId: string, actor: AuthUser) {
    const client = await this.clientsService.findOne(actor.agencyId, clientId);
    if (!canAccessClient(actor, client.agencyId, client.familyMemberIds ?? [])) {
      throw new ForbiddenException('Family member is not assigned to this client');
    }
    const reports = await this.weeklyReportModel
      .find({
        agencyId: new Types.ObjectId(actor.agencyId),
        clientId: new Types.ObjectId(clientId),
      })
      .sort({ weekStart: -1 })
      .lean();
    return reports.map((report) => {
      const parsed =
        typeof report.summary === 'string' && report.summary
          ? (JSON.parse(report.summary) as Record<string, unknown>)
          : {};
      return {
        _id: report._id,
        agencyId: report.agencyId,
        clientId: report.clientId,
        weekStart: report.weekStart,
        weekEnd: report.weekEnd,
        summary: {
          clientName: parsed.clientName ?? `${client.firstName} ${client.lastName}`,
          completedVisits: parsed.completedVisits ?? 0,
          lateVisits: parsed.lateVisits ?? 0,
          missedVisits: parsed.missedVisits ?? 0,
          aiSummary: parsed.aiSummary ?? '',
          careTasksSummary: parsed.careTasksSummary ?? parsed.tasksSummary ?? {},
          notableNotes: parsed.notableNotes ?? [],
          agencyFollowUp: parsed.agencyFollowUp ?? '',
          incidents:
            Array.isArray(parsed.incidents) && parsed.incidents.length > 0
              ? 'The agency reviewed visit issues and will follow up if needed.'
              : 'No major concerns were shared in this report.',
          familyConcerns: Array.isArray(parsed.familyConcerns) ? parsed.familyConcerns.length : 0,
        },
      };
    });
  }
}
