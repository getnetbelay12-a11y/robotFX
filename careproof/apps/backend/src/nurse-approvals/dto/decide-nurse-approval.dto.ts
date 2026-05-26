import { IsIn, IsString, IsOptional } from 'class-validator';

export class DecideNurseApprovalDto {
  @IsIn(['approved', 'rejected', 'needs_clarification'])
  decision!: 'approved' | 'rejected' | 'needs_clarification';

  @IsString()
  @IsOptional()
  nurseNotes?: string;
}
