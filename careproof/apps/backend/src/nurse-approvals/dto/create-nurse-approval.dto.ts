import { IsString, IsMongoId, IsOptional, IsIn } from 'class-validator';

export class CreateNurseApprovalDto {
  @IsMongoId()
  visitId!: string;

  @IsMongoId()
  @IsOptional()
  caregiverId?: string;

  @IsMongoId()
  @IsOptional()
  branchId?: string;

  @IsString()
  clientName!: string;

  @IsString()
  caregiverName!: string;

  @IsString()
  visitDate!: string;

  @IsString()
  visitType!: string;

  @IsIn(['low', 'medium', 'high', 'critical'])
  @IsOptional()
  priority?: string;

  @IsString()
  @IsOptional()
  nurseNotes?: string;
}
