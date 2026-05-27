import { IsString, IsIn, IsMongoId, IsOptional } from 'class-validator';

export class CreateSocialWorkCaseDto {
  @IsString()
  clientName!: string;

  @IsMongoId()
  @IsOptional()
  clientId?: string;

  @IsMongoId()
  @IsOptional()
  linkedConcernId?: string;

  @IsString()
  assignedWorker!: string;

  @IsIn(['housing', 'benefits', 'mental_health', 'family', 'legal', 'other'])
  category!: string;

  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  nextFollowUp?: string;
}
