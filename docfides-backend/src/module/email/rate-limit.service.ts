import {
  Injectable,
  BadRequestException,
  Inject,
  Optional,
  Logger,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  // Configuration
  private readonly REQUEST_OTP_MAX_PER_HOUR = 10;
  private readonly REQUEST_OTP_COOLDOWN_MINUTES = 10;
  private readonly VERIFY_OTP_MAX_ATTEMPTS = 5;
  private readonly VERIFY_OTP_LOCKOUT_MINUTES = 30;

  // Cache keys
  private readonly COOLDOWN_KEY_PREFIX = 'otp:cooldown:';
  private readonly HOURLY_KEY_PREFIX = 'otp:hourly:';

  constructor(
    @Optional()
    @Inject(CACHE_MANAGER)
    private cacheManager?: Cache,
  ) {}

  /**
   * Getter untuk max attempts (type-safe)
   */
  get maxAttemptsPerHour(): number {
    return this.REQUEST_OTP_MAX_PER_HOUR;
  }

  get maxVerifyAttempts(): number {
    return this.VERIFY_OTP_MAX_ATTEMPTS;
  }

  /**
   * Get hours since creation - extracted method untuk readability
   */
  private getHoursSinceCreation(createdAt: Date): number {
    const now = new Date();
    const millisecondsPassed = now.getTime() - new Date(createdAt).getTime();
    return Math.floor(millisecondsPassed / (1000 * 60 * 60));
  }

  /**
   * Get requests dalam 1 jam terakhir - public method agar bisa diakses dari service lain
   */
  getRequestsInCurrentHour(createdAt: Date, attemptCount: number): number {
    const hoursPassed = this.getHoursSinceCreation(createdAt);
    return hoursPassed < 1 ? attemptCount : 0;
  }

  /**
   * Cek apakah boleh request OTP - dengan optional Redis support
   */
  async checkRequestOtpLimitWithRedis(email: string): Promise<void> {
    if (!this.cacheManager) {
      this.logger.warn(
        'Redis not configured, skipping Redis-based rate limit check',
      );
      return;
    }

    const now = new Date();
    const cooldownKey = `${this.COOLDOWN_KEY_PREFIX}${email}`;
    const hourlyKey = `${this.HOURLY_KEY_PREFIX}${email}`;

    // 1. Cek cooldown (20 menit)
    const lastRequest = await this.cacheManager.get<number>(cooldownKey);
    if (lastRequest) {
      const minutesPassed = Math.floor(
        (now.getTime() - lastRequest) / (1000 * 60),
      );
      if (minutesPassed < this.REQUEST_OTP_COOLDOWN_MINUTES) {
        const remainingMinutes =
          this.REQUEST_OTP_COOLDOWN_MINUTES - minutesPassed;
        throw new BadRequestException(
          `Terlalu banyak permintaan OTP. Coba lagi dalam ${remainingMinutes} menit`,
        );
      }
    }

    // 2. Cek limit per jam (max 3 request)
    const hourlyCount = (await this.cacheManager.get<number>(hourlyKey)) ?? 0;
    if (hourlyCount >= this.REQUEST_OTP_MAX_PER_HOUR) {
      throw new BadRequestException(
        `Batas maksimal permintaan OTP sudah tercapai (${this.REQUEST_OTP_MAX_PER_HOUR}/jam). Coba lagi nanti.`,
      );
    }

    // 3. Update cache counters (atomic via expire)
    await this.cacheManager.set(
      cooldownKey,
      now.getTime(),
      this.REQUEST_OTP_COOLDOWN_MINUTES * 60 * 1000,
    );
    await this.cacheManager.set(hourlyKey, hourlyCount + 1, 60 * 60 * 1000);
  }

  /**
   * Cek OTP limit dengan DB (fallback ketika Redis tidak ada)
   * Dipanggil dari auth.service.ts
   */
  checkRequestOtpLimit(
    lastRequestAt: Date | null,
    createdAt: Date,
    requestCountThisHour: number,
  ): void {
    const now = new Date();

    // 1. Cek cooldown: jika ada request dalam 20 menit terakhir
    if (lastRequestAt) {
      const minutesSinceLastRequest = Math.floor(
        (now.getTime() - lastRequestAt.getTime()) / (1000 * 60),
      );

      if (minutesSinceLastRequest < this.REQUEST_OTP_COOLDOWN_MINUTES) {
        const remainingMinutes =
          this.REQUEST_OTP_COOLDOWN_MINUTES - minutesSinceLastRequest;
        throw new BadRequestException(
          `Terlalu banyak permintaan OTP. Coba lagi dalam ${remainingMinutes} menit`,
        );
      }
    }

    // 2. Cek limit per jam: max 3 request per jam
    if (requestCountThisHour >= this.REQUEST_OTP_MAX_PER_HOUR) {
      throw new BadRequestException(
        `Batas maksimal permintaan OTP sudah tercapai (${this.REQUEST_OTP_MAX_PER_HOUR}/jam). Coba lagi nanti.`,
      );
    }
  }

  /**
   * Cek apakah user boleh verify OTP
   */
  checkVerifyOtpLimit(
    attemptCount: number,
    isLocked: boolean,
    lockedUntil: Date | null,
  ): void {
    const now = new Date();

    // Cek status lock
    if (isLocked && lockedUntil && lockedUntil > now) {
      const minutesRemaining = Math.ceil(
        (lockedUntil.getTime() - now.getTime()) / (1000 * 60),
      );
      throw new BadRequestException(
        `Terlalu banyak percobaan gagal. Akun terkunci selama ${minutesRemaining} menit lagi.`,
      );
    }

    // Cek jumlah attempt
    if (attemptCount >= this.VERIFY_OTP_MAX_ATTEMPTS) {
      throw new BadRequestException(
        `Batas maksimal percobaan OTP sudah tercapai (${this.VERIFY_OTP_MAX_ATTEMPTS} percobaan).`,
      );
    }
  }

  /**
   * Hitung remaining attempts
   */
  getRemainingAttempts(attemptCount: number): number {
    return Math.max(0, this.VERIFY_OTP_MAX_ATTEMPTS - attemptCount);
  }

  /**
   * Kalkulasi lock until time
   */
  getLockUntilTime(): Date {
    const now = new Date();
    return new Date(
      now.getTime() + this.VERIFY_OTP_LOCKOUT_MINUTES * 60 * 1000,
    );
  }

  /**
   * Kalkulasi next request time setelah cooldown
   */
  getNextRequestTime(lastRequestAt: Date): Date {
    return new Date(
      lastRequestAt.getTime() + this.REQUEST_OTP_COOLDOWN_MINUTES * 60 * 1000,
    );
  }
}
