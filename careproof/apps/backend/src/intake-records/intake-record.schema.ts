import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type IntakeRecordDocument = IntakeRecord & Document;

@Schema({ timestamps: true, collection: 'intakeRecords' })
export class IntakeRecord {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  agencyId!: Types.ObjectId;

  @Prop({ required: true })
  clientName!: string;

  @Prop({ required: true })
  agentName!: string;

  @Prop({ required: true, enum: ['inquiry', 'assessment', 'authorization', 'onboarding', 'active'] })
  stage!: string;

  @Prop({ required: true })
  referralSource!: string;

  @Prop()
  primaryDiagnosis!: string;

  @Prop()
  insuranceType!: string;

  @Prop()
  startDate!: string;

  @Prop({ required: true, enum: ['low', 'medium', 'high', 'urgent'] })
  priority!: string;

  @Prop()
  notes!: string;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export const IntakeRecordSchema = SchemaFactory.createForClass(IntakeRecord);
IntakeRecordSchema.index({ agencyId: 1, stage: 1 });
