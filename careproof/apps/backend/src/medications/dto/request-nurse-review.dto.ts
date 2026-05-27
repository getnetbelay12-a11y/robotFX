import { IsOptional, IsString } from 'class-validator';

export class RequestNurseReviewDto {
  @IsString()
  @IsOptional()
  notes?: string;
}
