import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NurseApprovalDocument = NurseApproval & Document;

@Schema({ timestamps: true, collection: 'nurseApprovals' })
export class NurseApproval {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  agencyId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, index: true })
  branchId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  visitId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null, index: true })
  caregiverId!: Types.ObjectId | null;

  @Prop({ required: true })
  clientName!: string;

  @Prop({ required: true })
  caregiverName!: string;

  @Prop({ required: true })
  visitDate!: string;

  @Prop({ required: true })
  visitType!: string;

  @Prop({ required: true, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' })
  priority!: string;

  @Prop({
    required: true,
    enum: ['pending_review', 'approved', 'rejected', 'needs_clarification'],
    default: 'pending_review',
  })
  status!: string;

  @Prop()
  nurseNotes!: string;

  @Prop({ type: Types.ObjectId })
  reviewedBy!: Types.ObjectId;

  @Prop()
  reviewedAt!: Date;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export const NurseApprovalSchema = SchemaFactory.createForClass(NurseApproval);
NurseApprovalSchema.index({ agencyId: 1, status: 1 });
NurseApprovalSchema.index({ agencyId: 1, createdAt: -1 });
