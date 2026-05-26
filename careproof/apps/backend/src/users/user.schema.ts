import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum UserRole {
  PLATFORM_ADMIN = 'platform_admin',
  AGENCY_OWNER = 'agency_owner',
  AGENCY_ADMIN = 'agency_admin',
  CARE_COORDINATOR = 'care_coordinator',
  NURSE = 'nurse',
  SOCIAL_WORKER = 'social_worker',
  INTAKE_AGENT = 'intake_agent',
  CAREGIVER = 'caregiver',
  FAMILY_MEMBER = 'family_member',
  CLIENT = 'client',
}

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ type: Types.ObjectId, ref: 'Agency', required: true })
  agencyId!: Types.ObjectId;

  @Prop({ enum: UserRole, required: true })
  role!: UserRole;

  @Prop({ required: true })
  firstName!: string;

  @Prop({ required: true })
  lastName!: string;

  @Prop({ required: true, lowercase: true })
  email!: string;

  @Prop({ required: true })
  phone!: string;

  @Prop({ default: 'active' })
  status!: string;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  deletedBy?: Types.ObjectId | null;

  @Prop({ default: 'en' })
  language!: string;

  @Prop({
    type: {
      passwordHash: { type: String, required: true },
      refreshTokenHash: { type: String, default: null },
      mfaEnabled: { type: Boolean, default: false },
    },
    required: true,
  })
  auth!: {
    passwordHash: string;
    refreshTokenHash?: string | null;
    mfaEnabled?: boolean;
  };

  @Prop({ type: [String], default: [] })
  permissions!: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ agencyId: 1, email: 1 }, { unique: true });
UserSchema.index({ agencyId: 1, role: 1, status: 1 });
UserSchema.index({ agencyId: 1, deletedAt: 1, status: 1 });
