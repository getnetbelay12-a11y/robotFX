import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SocialWorkCaseDocument = SocialWorkCase & Document;

@Schema({ timestamps: true, collection: 'socialWorkCases' })
export class SocialWorkCase {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  agencyId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, index: true })
  branchId!: Types.ObjectId;

  @Prop({ required: true })
  clientName!: string;

  @Prop({ type: Types.ObjectId })
  clientId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, default: null })
  linkedConcernId?: Types.ObjectId | null;

  @Prop({ required: true })
  assignedWorker!: string;

  @Prop({ required: true, enum: ['housing', 'benefits', 'mental_health', 'family', 'legal', 'other'] })
  category!: string;

  @Prop({ required: true, enum: ['active', 'pending_review', 'closed', 'escalated'] })
  status!: string;

  @Prop()
  description!: string;

  @Prop()
  nextFollowUp!: string;

  @Prop({ required: true, enum: ['low', 'medium', 'high', 'urgent'] })
  priority!: string;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export const SocialWorkCaseSchema = SchemaFactory.createForClass(SocialWorkCase);
SocialWorkCaseSchema.index({ agencyId: 1, status: 1 });
