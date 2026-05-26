import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IntakeRecord, IntakeRecordDocument } from './intake-record.schema';
import { CreateIntakeRecordDto } from './dto/create-intake-record.dto';
import { UpdateIntakeStageDto } from './dto/update-intake-stage.dto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/types';
import { requirePermission } from '../auth/permissions';

@Injectable()
export class IntakeRecordsService {
  constructor(
    @InjectModel(IntakeRecord.name)
    private readonly model: Model<IntakeRecordDocument>,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: AuthUser) {
    requirePermission(actor.role, 'intake.read');
    return this.model
      .find({ agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null })
      .sort({ createdAt: -1 })
      .lean();
  }

  async create(actor: AuthUser, dto: CreateIntakeRecordDto) {
    requirePermission(actor.role, 'intake.write');
    const doc = await this.model.create({
      ...dto,
      agencyId: new Types.ObjectId(actor.agencyId),
    });
    await this.auditService.log({
      agencyId: new Types.ObjectId(actor.agencyId),
      actorUserId: new Types.ObjectId(actor.sub),
      action: 'INTAKE_RECORD_CREATED',
      entityType: 'intake_record',
      entityId: (doc as any)._id.toString(),
    });
    return doc;
  }

  async updateStage(actor: AuthUser, id: string, dto: UpdateIntakeStageDto) {
    requirePermission(actor.role, 'intake.write');
    const doc = await this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(id), agencyId: new Types.ObjectId(actor.agencyId), deletedAt: null },
      { stage: dto.stage },
      { new: true },
    );
    if (!doc) throw new NotFoundException('Intake record not found');
    await this.auditService.log({
      agencyId: new Types.ObjectId(actor.agencyId),
      actorUserId: new Types.ObjectId(actor.sub),
      action: `INTAKE_RECORD_STAGE_${dto.stage.toUpperCase()}`,
      entityType: 'intake_record',
      entityId: id,
    });
    return doc;
  }
}
