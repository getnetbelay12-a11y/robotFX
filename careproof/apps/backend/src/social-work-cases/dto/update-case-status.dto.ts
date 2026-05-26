import { IsIn, IsString, IsOptional } from 'class-validator';

export class UpdateCaseStatusDto {
  @IsIn(['active', 'pending_review', 'closed', 'escalated'])
  status!: 'active' | 'pending_review' | 'closed' | 'escalated';

  @IsString()
  @IsOptional()
  notes?: string;
}
