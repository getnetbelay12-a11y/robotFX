import { IsIn, IsOptional, IsString } from 'class-validator';
import { MEDICATION_STATUSES } from '../medication-record.schema';

export class UpdateMedicationStatusDto {
  @IsIn(MEDICATION_STATUSES)
  status!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
