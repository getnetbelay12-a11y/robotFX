import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateMedicationQuantityDto {
  @IsNumber()
  quantityAvailable!: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
