import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MedicationRecordDocument = MedicationRecord & Document;

export const MEDICATION_STATUSES = [
  'Available',
  'Low Stock',
  'Missing',
  'Expired',
  'Order Expired',
  'Needs Refill',
  'Needs Nurse Review',
  'Held',
  'Discontinued',
] as const;

@Schema({ timestamps: true, collection: 'medicationRecords' })
export class MedicationRecord {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  agencyId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  branchId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  clientId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null, index: true })
  visitId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, default: null })
  carePlanId?: Types.ObjectId | null;

  @Prop({ required: true })
  medicationName!: string;

  @Prop()
  genericName?: string;

  @Prop({ required: true })
  strength!: string;

  @Prop({ required: true })
  form!: string;

  @Prop({ required: true })
  route!: string;

  @Prop({ required: true })
  dose!: string;

  @Prop({ required: true })
  frequency!: string;

  @Prop({ required: true })
  purpose!: string;

  @Prop({ required: true })
  prescriberName!: string;

  @Prop()
  pharmacyName?: string;

  @Prop({ required: true })
  startDate!: string;

  @Prop()
  stopDate?: string;

  @Prop({ required: true })
  medicationExpiryDate!: string;

  @Prop({ required: true })
  orderExpiryDate!: string;

  @Prop({ required: true })
  lastReconciledAt!: string;

  @Prop({ required: true })
  nextReconciliationDue!: string;

  @Prop({ required: true })
  quantityAvailable!: number;

  @Prop({ required: true })
  minimumRequiredQuantity!: number;

  @Prop({ required: true })
  storageRequirement!: string;

  @Prop({ default: false })
  isHighRisk!: boolean;

  @Prop({ default: false })
  requiresNurseReview!: boolean;

  @Prop({ type: Types.ObjectId, default: null })
  nurseApprovalId?: Types.ObjectId | null;

  @Prop({ required: true, enum: MEDICATION_STATUSES, default: 'Available' })
  status!: string;

  @Prop()
  notes?: string;

  @Prop({ default: false })
  familyVisible!: boolean;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export const MedicationRecordSchema = SchemaFactory.createForClass(MedicationRecord);
MedicationRecordSchema.index({ agencyId: 1, branchId: 1 });
MedicationRecordSchema.index({ agencyId: 1, clientId: 1 });
MedicationRecordSchema.index({ agencyId: 1, status: 1 });
MedicationRecordSchema.index({ agencyId: 1, medicationExpiryDate: 1 });
MedicationRecordSchema.index({ agencyId: 1, orderExpiryDate: 1 });
MedicationRecordSchema.index({ agencyId: 1, nextReconciliationDue: 1 });
