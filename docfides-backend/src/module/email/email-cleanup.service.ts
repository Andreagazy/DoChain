import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailCleanupService {
  private readonly logger = new Logger(EmailCleanupService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Cleanup expired/unused verifications
   * Run setiap hari jam 2 pagi (02:00 AM)
   *
   * Menghapus record yang:
   * 1. Belum diverifikasi (verified = false)
   * 2. OTP sudah expired
   * 3. Dibuat > 24 jam yang lalu (cukup waktu untuk user retry)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredVerifications() {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const result = await this.prisma.emailVerification.deleteMany({
        where: {
          AND: [
            { verified: false }, // Belum diverifikasi
            { expiresAt: { lt: new Date() } }, // OTP sudah expired
            { createdAt: { lt: oneDayAgo } }, // > 24 jam lalu
          ],
        },
      });

      this.logger.log(
        `✅ Cleanup completed: Deleted ${result.count} expired verifications`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Cleanup failed:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /**
   * Cleanup locked accounts yang sudah unlock/expired
   * Run setiap Minggu jam 03:00 AM (0 3 * * 0)
   *
   * Menghapus record yang:
   * 1. Tidak terkunci lagi (isLocked = false)
   * 2. Memiliki lockUntil time (pernah di-lock sebelumnya)
   * 3. Belum diverifikasi
   * 4. Dibuat > 7 hari yang lalu
   */
  @Cron('0 3 * * 0')
  async cleanupUnlockedAccounts() {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const result = await this.prisma.emailVerification.deleteMany({
        where: {
          AND: [
            { isLocked: false }, // Sudah unlock
            { lockedUntil: { not: null } }, // Pernah di-lock
            { verified: false }, // Belum diverifikasi
            { createdAt: { lt: sevenDaysAgo } }, // > 7 hari
          ],
        },
      });

      this.logger.log(
        `✅ Weekly cleanup completed: Deleted ${result.count} unlocked accounts`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Weekly cleanup failed:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /**
   * Cleanup all verified records that registered successfully
   * Run setiap hari jam 4 pagi (04:00 AM)
   *
   * Menghapus record yang sudah berhasil diverifikasi dan user sudah terdaftar
   * (record ini sudah dihapus saat register, tapi ada kemungkinan tertinggal)
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanupVerifiedRecords() {
    try {
      const result = await this.prisma.emailVerification.deleteMany({
        where: {
          verified: true, // Sudah verified tapi masih ada di table
        },
      });

      if (result.count > 0) {
        this.logger.log(
          `✅ Verified records cleanup: Deleted ${result.count} verified emails`,
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ Verified records cleanup failed:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}
