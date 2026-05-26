import { IsIn } from 'class-validator';

export class UpdateRenewalStatusDto {
  @IsIn(['current', 'expiring_soon', 'expired', 'renewed'])
  status!: 'current' | 'expiring_soon' | 'expired' | 'renewed';
}
