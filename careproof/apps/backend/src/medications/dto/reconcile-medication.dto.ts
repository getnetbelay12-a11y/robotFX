import { IsOptional, IsString } from 'class-validator';

export class ReconcileMedicationDto {
  @IsString()
  @IsOptional()
  lastReconciledAt?: string;

  @IsString()
  nextReconciliationDue!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
