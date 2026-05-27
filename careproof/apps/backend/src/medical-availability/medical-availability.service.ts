import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MedicalAvailability, MedicalAvailabilityDocument } from './medical-availability.schema';
import { UpdateAvailabilityStatusDto } from './dto/update-availability-status.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/types';
import { requirePermission } from '../auth/permissions';

@Injectable()
export class MedicalAvailabilityService {
  constructor(
    @InjectModel(MedicalAvailability.name)
    private readonly model: Model<MedicalAvailabilityDocument>,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: AuthUser) {
    requirePermission(actor.role, 'medical_availability.read');
    const filter: Record<string, unknown> = { agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null };
    if (actor.branchId) filter.branchId = new Types.ObjectId(actor.branchId);
    return this.model
      .find(filter)
      .sort({ scheduledDate: 1 })
      .lean();
  }

  async updateStatus(actor: AuthUser, id: string, dto: UpdateAvailabilityStatusDto) {
    requirePermission(actor.role, 'medical_availability.write');
    const update: Record<string, unknown> = { status: dto.status, notes: dto.notes };
    if (dto.status === 'confirmed') update.confirmedAt = new Date();
    const doc = await this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(id), agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null },
      update,
      { new: true },
    );
    if (!doc) throw new NotFoundException('Medical availability record not found');
    await this.auditService.log({
      agencyId: new Types.ObjectId(actor.agencyId),
      actorUserId: new Types.ObjectId(actor.sub),
      action: `MEDICAL_AVAILABILITY_${dto.status.toUpperCase()}`,
      entityType: 'medical_availability',
      entityId: id,
    });
    return doc;
  }
}
