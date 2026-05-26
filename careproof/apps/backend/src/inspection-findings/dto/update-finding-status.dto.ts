import { IsIn, IsString, IsOptional } from 'class-validator';

export class UpdateFindingStatusDto {
  @IsIn(['open', 'in_progress', 'resolved', 'waived'])
  status!: 'open' | 'in_progress' | 'resolved' | 'waived';

  @IsString()
  @IsOptional()
  notes?: string;
}
