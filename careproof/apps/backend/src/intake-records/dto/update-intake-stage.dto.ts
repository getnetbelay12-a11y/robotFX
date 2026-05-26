import { IsIn, IsString, IsOptional } from 'class-validator';

export class UpdateIntakeStageDto {
  @IsIn(['inquiry', 'assessment', 'authorization', 'onboarding', 'active'])
  stage!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
