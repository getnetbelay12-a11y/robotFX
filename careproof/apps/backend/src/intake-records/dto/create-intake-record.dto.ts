import { IsString, IsIn, IsOptional, IsMongoId } from 'class-validator';

export class CreateIntakeRecordDto {
  @IsString()
  clientName!: string;

  @IsString()
  agentName!: string;

  @IsMongoId()
  @IsOptional()
  branchId?: string;

  @IsIn(['inquiry', 'assessment', 'authorization', 'onboarding', 'active'])
  stage!: string;

  @IsString()
  referralSource!: string;

  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority!: string;

  @IsString()
  @IsOptional()
  primaryDiagnosis?: string;

  @IsString()
  @IsOptional()
  insuranceType?: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
