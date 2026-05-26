import { UserRole } from '../users/user.schema';

export interface AuthUser {
  sub: string;
  agencyId: string;
  role: UserRole;
  email: string;
  branchId?: string | null;
}
