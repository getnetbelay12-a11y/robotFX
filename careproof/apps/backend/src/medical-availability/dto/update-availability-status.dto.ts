import { IsIn, IsString, IsOptional } from 'class-validator';

export class UpdateAvailabilityStatusDto {
  @IsIn(['confirmed', 'pending', 'unavailable', 'on_hold'])
  status!: 'confirmed' | 'pending' | 'unavailable' | 'on_hold';

  @IsString()
  @IsOptional()
  notes?: string;
}
