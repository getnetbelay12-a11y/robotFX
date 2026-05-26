import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ExpirationRecordDocument = ExpirationRecord & Document;

@Schema({ timestamps: true, collection: 'expirationRecords' })
export class ExpirationRecord {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  agencyId!: Types.ObjectId;

  @Prop({ required: true })
  caregiverName!: string;

  @Prop({ type: Types.ObjectId })
  caregiverId!: Types.ObjectId;

  @Prop({ required: true })
  documentType!: string;

  @Prop({ required: true })
  expiryDate!: string;

  @Prop({ required: true, enum: ['current', 'expiring_soon', 'expired', 'renewed'] })
  status!: string;

  @Prop()
  renewalSubmittedAt!: Date;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export const ExpirationRecordSchema = SchemaFactory.createForClass(ExpirationRecord);
ExpirationRecordSchema.index({ agencyId: 1, status: 1 });
ExpirationRecordSchema.index({ agencyId: 1, expiryDate: 1 });
