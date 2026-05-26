import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InspectionFindingDocument = InspectionFinding & Document;

@Schema({ timestamps: true, collection: 'inspectionFindings' })
export class InspectionFinding {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  agencyId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  ruleId!: Types.ObjectId;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true, enum: ['critical', 'high', 'medium', 'low'] })
  severity!: string;

  @Prop({ required: true, enum: ['open', 'in_progress', 'resolved', 'waived'] })
  status!: string;

  @Prop()
  description!: string;

  @Prop()
  assignedTo!: string;

  @Prop()
  dueDate!: string;

  @Prop()
  resolvedAt!: Date;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export const InspectionFindingSchema = SchemaFactory.createForClass(InspectionFinding);
InspectionFindingSchema.index({ agencyId: 1, status: 1 });
