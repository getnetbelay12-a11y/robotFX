import { HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { MonitoringService } from '../monitoring/monitoring.service';
import { UsersService } from '../users/users.service';
import { AuthUser } from './types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly failedLoginAttempts = new Map<string, { count: number; blockedUntil: number; lastAttemptAt: number }>();
  private readonly failedLoginLimit = 5;
  private readonly failedLoginWindowMs = 15 * 60_000;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly monitoringService: MonitoringService,
  ) {}

  async login(dto: LoginDto, ipAddress = 'unknown') {
    const rateLimitKey = `${ipAddress}:${dto.email.toLowerCase()}`;
    this.assertLoginAllowed(rateLimitKey);
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !(await argon2.verify(user.auth.passwordHash, dto.password))) {
      this.recordFailedLogin(rateLimitKey);
      this.logger.warn(JSON.stringify({ event: 'auth.login_failed', email: dto.email.toLowerCase() }));
      this.monitoringService.captureEvent('auth.login_failed', { email: dto.email.toLowerCase() });
      throw new UnauthorizedException('Invalid credentials');
    }
    this.failedLoginAttempts.delete(rateLimitKey);
    return this.issueTokens({
      sub: user.id,
      agencyId: user.agencyId.toString(),
      role: user.role,
      email: user.email,
      branchId: user.branchId?.toString() ?? null,
    });
  }

  async refresh(dto: RefreshDto) {
    const payload = this.decodeToken(dto.refreshToken);
    const user = await this.usersService.validateRefreshToken(payload.sub, dto.refreshToken);
    if (!user) {
      this.monitoringService.captureEvent('auth.refresh_failed', { userId: payload.sub });
      throw new UnauthorizedException('Invalid refresh token');
    }
    return this.issueTokens({
      sub: user.id,
      agencyId: user.agencyId.toString(),
      role: user.role,
      email: user.email,
      branchId: user.branchId?.toString() ?? null,
    });
  }

  async logout(userId: string) {
    await this.usersService.setRefreshToken(userId, null);
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.usersService.findUserDocumentById(userId);
    return {
      id: user.id,
      agencyId: user.agencyId.toString(),
      role: user.role,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
    };
  }

  private async issueTokens(payload: AuthUser) {
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('jwtSecret'),
      expiresIn: this.configService.getOrThrow<string>('jwtAccessTtl') as never,
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('jwtRefreshSecret'),
      expiresIn: this.configService.getOrThrow<string>('jwtRefreshTtl') as never,
    });
    await this.usersService.setRefreshToken(payload.sub, refreshToken);
    return { accessToken, refreshToken, user: payload };
  }

  private decodeToken(token: string): AuthUser {
    return this.jwtService.verify<AuthUser>(token, {
      secret: this.configService.getOrThrow<string>('jwtRefreshSecret'),
    });
  }

  private assertLoginAllowed(rateLimitKey: string) {
    const record = this.failedLoginAttempts.get(rateLimitKey);
    if (!record) {
      return;
    }

    if (record.blockedUntil > Date.now()) {
      throw new HttpException('Too many failed login attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    if (Date.now() - record.lastAttemptAt > this.failedLoginWindowMs) {
      this.failedLoginAttempts.delete(rateLimitKey);
    }
  }

  private recordFailedLogin(rateLimitKey: string) {
    const now = Date.now();
    const existing = this.failedLoginAttempts.get(rateLimitKey);
    if (!existing || now - existing.lastAttemptAt > this.failedLoginWindowMs) {
      this.failedLoginAttempts.set(rateLimitKey, {
        count: 1,
        blockedUntil: 0,
        lastAttemptAt: now,
      });
      return;
    }

    const count = existing.count + 1;
    this.failedLoginAttempts.set(rateLimitKey, {
      count,
      blockedUntil: count >= this.failedLoginLimit ? now + this.failedLoginWindowMs : 0,
      lastAttemptAt: now,
    });
  }
}
