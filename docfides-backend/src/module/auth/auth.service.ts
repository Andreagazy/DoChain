/* eslint-disable @typescript-eslint/require-await */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { RateLimitService } from '../email/rate-limit.service';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { addMinutes } from 'date-fns';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private rateLimitService: RateLimitService,
  ) { }

  // --- Fungsi untuk login (sudah ada) ---
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.deletedAt) {
      throw new UnauthorizedException('Account deleted');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account not active');
    }

    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Email not verified');
    }

    return user;
  }

  async login(user: { id: string; email: string; role: string }) {
    const payload = { sub: user.id, email: user.email };
    return {
      message: 'Login berhasil',
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        identity: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      identityStatus: user.identity?.status ?? null,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
      },
    });

    return {
      message: 'Profil berhasil diperbarui',
      user,
    };
  }

  // --- Fungsi untuk registrasi dengan OTP ---
  private generateOtp(): string {
    return randomInt(100000, 999999).toString();
  }

  async requestOtp(email: string): Promise<void> {
    try {
      // Cek apakah email sudah terdaftar sebagai user
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        throw new BadRequestException('Email sudah terdaftar');
      }

      // Cek existing verification record untuk rate limiting
      let existingVerification = await this.prisma.emailVerification.findUnique(
        {
          where: { email },
        },
      );

      // Rate limiting check untuk request OTP
      if (existingVerification) {
        await this.rateLimitService.checkRequestOtpLimitWithRedis(email);

        this.rateLimitService.checkRequestOtpLimit(
          existingVerification.lastRequestAt,
          existingVerification.createdAt,
          0,
        );
      } else {
        await this.rateLimitService.checkRequestOtpLimitWithRedis(email);
      }

      // Generate dan hash OTP
      const otp = this.generateOtp();
      const hashedOtp = await bcrypt.hash(otp, 10);
      const expiresAt = addMinutes(new Date(), 10);

      // Upsert dengan update lastRequestAt
      existingVerification = await this.prisma.emailVerification.upsert({
        where: { email },
        update: {
          otp: hashedOtp,
          expiresAt,
          verified: false,
          attemptCount: 0, // Reset attempt counter
          lastAttemptAt: null,
          isLocked: false,
          lockedUntil: null,
          lastRequestAt: new Date(), // Track request time
        },
        create: {
          email,
          otp: hashedOtp,
          expiresAt,
          lastRequestAt: new Date(),
        },
      });

      // Kirim email
      try {
        await this.emailService.sendOtpEmail(email, otp);
        this.logger.debug(`OTP email sent successfully to ${email}`);
      } catch (error) {
        this.logger.error(
          `Failed to send OTP email to ${email}`,
          error instanceof Error ? error.message : error,
        );
        throw new BadRequestException('Gagal mengirim email, coba lagi nanti');
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Unexpected error in requestOtp', error);
      throw new BadRequestException(
        'Terjadi kesalahan saat memproses permintaan OTP',
      );
    }
  }

  async verifyOtp(email: string, otp: string): Promise<{ message: string }> {
    try {
      const record = await this.prisma.emailVerification.findUnique({
        where: { email },
      });

      if (!record) {
        throw new BadRequestException(
          'Tidak ada permintaan OTP untuk email ini',
        );
      }

      // Rate limiting check dengan lockout
      this.rateLimitService.checkVerifyOtpLimit(
        record.attemptCount,
        record.isLocked,
        record.lockedUntil,
      );

      if (record.verified) {
        throw new BadRequestException('Email sudah diverifikasi');
      }

      if (record.expiresAt < new Date()) {
        throw new BadRequestException('OTP sudah kadaluarsa');
      }

      const valid = await bcrypt.compare(otp, record.otp);

      if (!valid) {
        const newAttemptCount = record.attemptCount + 1;
        const remainingAttempts =
          this.rateLimitService.getRemainingAttempts(newAttemptCount);

        // Jika attempt sudah maksimal, lock akun
        const shouldLock =
          newAttemptCount >= this.rateLimitService.maxVerifyAttempts;

        await this.prisma.emailVerification.update({
          where: { email },
          data: {
            attemptCount: newAttemptCount,
            lastAttemptAt: new Date(),
            ...(shouldLock && {
              isLocked: true,
              lockedUntil: this.rateLimitService.getLockUntilTime(),
            }),
          },
        });

        const errorMessage =
          remainingAttempts > 0
            ? `OTP salah. Sisa percobaan: ${remainingAttempts}`
            : 'Terlalu banyak percobaan gagal. Akun terkunci untuk sementara.';

        throw new BadRequestException(errorMessage);
      }

      // OTP valid - reset attempt counter dan set verified
      await this.prisma.emailVerification.update({
        where: { email },
        data: {
          verified: true,
          attemptCount: 0,
          isLocked: false,
          lockedUntil: null,
        },
      });

      this.logger.debug(`Email ${email} verified successfully`);

      return { message: 'OTP valid, silakan lanjutkan registrasi' };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Unexpected error in verifyOtp', error);
      throw new BadRequestException('Terjadi kesalahan saat memverifikasi OTP');
    }
  }

  async register(email: string, password: string, confirmPassword: string) {
    if (password !== confirmPassword) {
      throw new BadRequestException('Password dan konfirmasi tidak cocok');
    }

    const verification = await this.prisma.emailVerification.findFirst({
      where: {
        email,
        verified: true,
      },
    });

    if (!verification) {
      throw new UnauthorizedException('Email belum diverifikasi');
    }

    // Cek ulang apakah user sudah ada (antisipasi race condition)
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new BadRequestException('Email sudah terdaftar');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Buat user beserta role default USER
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        role: 'MEMBER',
      },
    });

    // Hapus record verifikasi (sudah tidak diperlukan)
    await this.prisma.emailVerification.delete({ where: { email } });

    // Generate JWT token
    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    return {
      message: 'Registrasi berhasil',
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
}
