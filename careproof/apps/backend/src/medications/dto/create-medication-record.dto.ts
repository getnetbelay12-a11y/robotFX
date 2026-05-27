import { IsBoolean, IsIn, IsMongoId, IsNumber, IsOptional, IsString } from 'class-validator';
import { MEDICATION_STATUSES } from '../medication-record.schema';

export class CreateMedicationRecordDto {
  @IsMongoId()
  branchId!: string;

  @IsMongoId()
  clientId!: string;

  @IsMongoId()
  @IsOptional()
  visitId?: string;

  @IsMongoId()
  @IsOptional()
  carePlanId?: string;

  @IsString()
  medicationName!: string;

  @IsString()
  @IsOptional()
  genericName?: string;

  @IsString()
  strength!: string;

  @IsString()
  form!: string;

  @IsString()
  route!: string;

  @IsString()
  dose!: string;

  @IsString()
  frequency!: string;

  @IsString()
  purpose!: string;

  @IsString()
  prescriberName!: string;

  @IsString()
  @IsOptional()
  pharmacyName?: string;

  @IsString()
  startDate!: string;

  @IsString()
  @IsOptional()
  stopDate?: string;

  @IsString()
  medicationExpiryDate!: string;

  @IsString()
  orderExpiryDate!: string;

  @IsString()
  lastReconciledAt!: string;

  @IsString()
  nextReconciliationDue!: string;

  @IsNumber()
  quantityAvailable!: number;

  @IsNumber()
  minimumRequiredQuantity!: number;

  @IsString()
  storageRequirement!: string;

  @IsBoolean()
  @IsOptional()
  isHighRisk?: boolean;

  @IsBoolean()
  @IsOptional()
  requiresNurseReview?: boolean;

  @IsIn(MEDICATION_STATUSES)
  status!: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  familyVisible?: boolean;
}
