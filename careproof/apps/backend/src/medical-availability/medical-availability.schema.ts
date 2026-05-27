import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MedicalAvailabilityDocument = MedicalAvailability & Document;

@Schema({ timestamps: true, collection: 'medicalAvailability' })
export class MedicalAvailability {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  agencyId!: Types.ObjectId;

  @Prop({ required: true })
  clientName!: string;

  @Prop({ type: Types.ObjectId })
  clientId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, index: true })
  branchId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null })
  visitId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, default: null })
  sourceMedicationId?: Types.ObjectId | null;

  @Prop({ required: true })
  serviceType!: string;

  @Prop({ required: true, enum: ['confirmed', 'pending', 'unavailable', 'on_hold'] })
  status!: string;

  @Prop({ required: true })
  scheduledDate!: string;

  @Prop()
  providerName!: string;

  @Prop()
  notes!: string;

  @Prop()
  confirmedAt!: Date;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export const MedicalAvailabilitySchema = SchemaFactory.createForClass(MedicalAvailability);
MedicalAvailabilitySchema.index({ agencyId: 1, status: 1 });
MedicalAvailabilitySchema.index({ agencyId: 1, branchId: 1 });
