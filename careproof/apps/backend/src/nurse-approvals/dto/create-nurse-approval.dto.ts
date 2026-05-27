import { IsString, IsMongoId, IsOptional } from 'class-validator';

export class CreateNurseApprovalDto {
  @IsMongoId()
  visitId!: string;

  @IsMongoId()
  @IsOptional()
  caregiverId?: string;

  @IsString()
  clientName!: string;

  @IsString()
  caregiverName!: string;

  @IsString()
  visitDate!: string;

  @IsString()
  visitType!: string;

  @IsString()
  @IsOptional()
  nurseNotes?: string;
}
