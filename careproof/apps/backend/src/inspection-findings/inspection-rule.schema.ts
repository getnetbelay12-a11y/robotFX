import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InspectionRuleDocument = InspectionRule & Document;

@Schema({ timestamps: true, collection: 'inspectionRules' })
export class InspectionRule {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  agencyId!: Types.ObjectId;

  @Prop({ required: true })
  ruleCode!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true, enum: ['critical', 'high', 'medium', 'low', 'compliance'] })
  severity!: string;

  @Prop({ required: true })
  category!: string;

  @Prop({ required: true, default: true })
  active!: boolean;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export const InspectionRuleSchema = SchemaFactory.createForClass(InspectionRule);
