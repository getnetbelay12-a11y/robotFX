import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ExpirationRecord, ExpirationRecordDocument } from './expiration-record.schema';
import { UpdateRenewalStatusDto } from './dto/update-renewal-status.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/types';
import { requirePermission } from '../auth/permissions';

@Injectable()
export class ExpirationRecordsService {
  constructor(
    @InjectModel(ExpirationRecord.name)
    private readonly model: Model<ExpirationRecordDocument>,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: AuthUser) {
    requirePermission(actor.role, 'expiration.read');
    return this.model
      .find({ agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null })
      .sort({ expiryDate: 1 })
      .lean();
  }

  async updateRenewalStatus(actor: AuthUser, id: string, dto: UpdateRenewalStatusDto) {
    requirePermission(actor.role, 'expiration.write');
    const update: Record<string, unknown> = { status: dto.status };
    if (dto.status === 'renewed') update.renewalSubmittedAt = new Date();
    const doc = await this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(id), agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null },
      update,
      { new: true },
    );
    if (!doc) throw new NotFoundException('Expiration record not found');
    await this.auditService.log({
      agencyId: new Types.ObjectId(actor.agencyId),
      actorUserId: new Types.ObjectId(actor.sub),
      action: `EXPIRATION_RECORD_${dto.status.toUpperCase()}`,
      entityType: 'expiration_record',
      entityId: id,
    });
    return doc;
  }
}
