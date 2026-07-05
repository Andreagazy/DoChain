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
import { ChangePasswordDto } from './dto/change-password.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestAcademicProfileChangeDto } from './dto/academic-profile-change.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private rateLimitService: RateLimitService,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private emailEquals(email: string) {
    return {
      equals: this.normalizeEmail(email),
      mode: 'insensitive' as const,
    };
  }

  // --- Fungsi untuk login (sudah ada) ---
  async validateUser(email: string, password: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findFirst({
      where: { email: this.emailEquals(normalizedEmail) },
    });

    if (!user) {
      throw new UnauthorizedException('Email belum terdaftar di DOCChain');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedException('Password yang Anda masukkan tidak sesuai');
    }

    if (user.deletedAt) {
      throw new UnauthorizedException(
        'Akun ini sudah dinonaktifkan. Silakan hubungi admin',
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Akun belum aktif. Silakan hubungi admin prodi atau superadmin',
      );
    }

    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException(
        'Email akun belum diverifikasi. Silakan hubungi admin',
      );
    }

    return user;
  }

  async login(user: {
    id: string;
    email: string;
    role: string;
    displayName?: string | null;
  }) {
    const payload = { sub: user.id, email: user.email };
    return {
      message: 'Login berhasil',
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.displayName ?? null,
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
        studentProfile: {
          select: {
            nim: true,
            angkatan: true,
            kelas: true,
            prodi: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        employeeProfile: {
          select: {
            nip: true,
            nidn: true,
            employeeType: true,
            positionTitle: true,
            homeUnit: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
              },
            },
          },
        },
        structuralAssignments: {
          where: {
            isActive: true,
            endsAt: null,
          },
          select: {
            position: true,
            academicUnit: {
              select: {
                code: true,
                name: true,
                type: true,
              },
            },
          },
        },
        identity: {
          select: {
            status: true,
            fullName: true,
            nik: true,
          },
        },
        academicProfileChangeRequests: {
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            nim: true,
            angkatan: true,
            kelas: true,
            status: true,
            createdAt: true,
            prodi: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
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
      identity: user.identity
        ? {
            status: user.identity.status,
            fullName: user.identity.fullName,
            nik: user.identity.nik,
          }
        : null,
      academicProfile: this.buildAcademicProfile(user),
      pendingAcademicProfileChangeRequest:
        user.academicProfileChangeRequests[0] ?? null,
    };
  }

  private buildAcademicProfile(user: {
    role: string;
    studentProfile?: {
      nim: string;
      angkatan: number | null;
      kelas: string | null;
      prodi: { id: string; code: string; name: string };
    } | null;
    employeeProfile?: {
      nip: string | null;
      nidn: string | null;
      employeeType: string;
      positionTitle: string | null;
      homeUnit: { id: string; code: string; name: string; type: string };
    } | null;
    structuralAssignments?: Array<{
      position: string;
      academicUnit: { code: string; name: string; type: string };
    }>;
    academicProfileChangeRequests?: unknown[];
  }) {
    if (user.studentProfile) {
      return {
        type: 'STUDENT',
        identifier: user.studentProfile.nim,
        unitId: user.studentProfile.prodi.id,
        unitCode: user.studentProfile.prodi.code,
        unitName: user.studentProfile.prodi.name,
        unitType: 'PRODI',
        angkatan: user.studentProfile.angkatan,
        kelas: user.studentProfile.kelas,
        positionTitle: null,
        structuralPositions: [],
      };
    }

    if (user.employeeProfile) {
      return {
        type: 'EMPLOYEE',
        identifier: user.employeeProfile.nip ?? user.employeeProfile.nidn,
        unitId: user.employeeProfile.homeUnit.id,
        unitCode: user.employeeProfile.homeUnit.code,
        unitName: user.employeeProfile.homeUnit.name,
        unitType: user.employeeProfile.homeUnit.type,
        employeeType: user.employeeProfile.employeeType,
        positionTitle: user.employeeProfile.positionTitle,
        structuralPositions: user.structuralAssignments ?? [],
      };
    }

    return null;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
      },
    });

    return {
      message: 'Profil berhasil diperbarui',
      user: await this.getProfile(userId),
    };
  }

  async requestAcademicProfileChange(
    userId: string,
    dto: RequestAcademicProfileChangeDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        studentProfile: { select: { id: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    if (user.role !== 'MAHASISWA') {
      throw new BadRequestException(
        'Request perubahan profil akademik mandiri hanya tersedia untuk mahasiswa',
      );
    }

    if (!user.studentProfile) {
      throw new BadRequestException('Profil mahasiswa belum tersedia');
    }

    const pending = await this.prisma.academicProfileChangeRequest.findFirst({
      where: { userId, status: 'PENDING' },
      select: { id: true },
    });

    if (pending) {
      throw new BadRequestException(
        'Masih ada request perubahan profil akademik yang menunggu review admin',
      );
    }

    const prodi = await this.prisma.academicUnit.findFirst({
      where: {
        id: dto.prodiId,
        type: 'PRODI',
        isActive: true,
      },
      select: { id: true },
    });

    if (!prodi) {
      throw new BadRequestException('Program studi tidak valid atau tidak aktif');
    }

    const existingNim = await this.prisma.studentProfile.findUnique({
      where: { nim: dto.nim },
      select: { userId: true },
    });

    if (existingNim && existingNim.userId !== userId) {
      throw new BadRequestException('NIM sudah digunakan oleh mahasiswa lain');
    }

    const pendingNim = await this.prisma.academicProfileChangeRequest.findFirst({
      where: {
        nim: dto.nim,
        status: 'PENDING',
        userId: { not: userId },
      },
      select: { id: true },
    });

    if (pendingNim) {
      throw new BadRequestException('NIM sedang diajukan oleh mahasiswa lain');
    }

    const request = await this.prisma.academicProfileChangeRequest.create({
      data: {
        userId,
        nim: dto.nim.trim(),
        prodiId: dto.prodiId,
        angkatan: dto.angkatan ?? null,
        kelas: dto.kelas?.trim() || null,
      },
      select: {
        id: true,
        nim: true,
        angkatan: true,
        kelas: true,
        status: true,
        createdAt: true,
        prodi: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return {
      message:
        'Request perubahan profil akademik berhasil diajukan dan menunggu review admin',
      request,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Password baru dan konfirmasi tidak cocok');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Password baru harus berbeda dari password lama');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    const currentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!currentPasswordValid) {
      throw new UnauthorizedException('Password lama tidak sesuai');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, 10),
      },
    });

    return { message: 'Password berhasil diganti' };
  }

  // --- Fungsi untuk registrasi dengan OTP ---
  private generateOtp(): string {
    return randomInt(100000, 999999).toString();
  }

  async requestOtp(email: string): Promise<void> {
    try {
      const normalizedEmail = this.normalizeEmail(email);

      // Cek apakah email sudah terdaftar sebagai user
      const existingUser = await this.prisma.user.findFirst({
        where: { email: this.emailEquals(normalizedEmail) },
      });
      if (existingUser) {
        throw new BadRequestException('Email sudah terdaftar');
      }

      // Cek existing verification record untuk rate limiting
      let existingVerification = await this.prisma.emailVerification.findUnique(
        {
          where: { email: normalizedEmail },
        },
      );

      // Rate limiting check untuk request OTP
      if (existingVerification) {
        await this.rateLimitService.checkRequestOtpLimitWithRedis(normalizedEmail);

        this.rateLimitService.checkRequestOtpLimit(
          existingVerification.lastRequestAt,
          existingVerification.createdAt,
          0,
        );
      } else {
        await this.rateLimitService.checkRequestOtpLimitWithRedis(normalizedEmail);
      }

      // Generate dan hash OTP
      const otp = this.generateOtp();
      const hashedOtp = await bcrypt.hash(otp, 10);
      const expiresAt = addMinutes(new Date(), 10);

      // Upsert dengan update lastRequestAt
      existingVerification = await this.prisma.emailVerification.upsert({
        where: { email: normalizedEmail },
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
          email: normalizedEmail,
          otp: hashedOtp,
          expiresAt,
          lastRequestAt: new Date(),
        },
      });

      // Kirim email
      try {
        await this.emailService.sendOtpEmail(normalizedEmail, otp);
        this.logger.debug(`OTP email sent successfully to ${normalizedEmail}`);
      } catch (error) {
        this.logger.error(
          `Failed to send OTP email to ${normalizedEmail}`,
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
      const normalizedEmail = this.normalizeEmail(email);
      const record = await this.prisma.emailVerification.findUnique({
        where: { email: normalizedEmail },
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
          where: { email: normalizedEmail },
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
        where: { email: normalizedEmail },
        data: {
          verified: true,
          attemptCount: 0,
          isLocked: false,
          lockedUntil: null,
        },
      });

      this.logger.debug(`Email ${normalizedEmail} verified successfully`);

      return { message: 'OTP valid, silakan lanjutkan registrasi' };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Unexpected error in verifyOtp', error);
      throw new BadRequestException('Terjadi kesalahan saat memverifikasi OTP');
    }
  }

  async getRegisterOptions() {
    const prodi = await this.prisma.academicUnit.findMany({
      where: {
        type: 'PRODI',
        isActive: true,
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        parentId: true,
      },
    });

    return { prodi };
  }

  async register(dto: RegisterDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Password dan konfirmasi tidak cocok');
    }

    const normalizedEmail = this.normalizeEmail(dto.email);

    const verification = await this.prisma.emailVerification.findFirst({
      where: {
        email: normalizedEmail,
        verified: true,
      },
    });

    if (!verification) {
      throw new UnauthorizedException('Email belum diverifikasi');
    }

    // Cek ulang apakah user sudah ada (antisipasi race condition)
    const existingUser = await this.prisma.user.findFirst({
      where: { email: this.emailEquals(normalizedEmail) },
    });
    if (existingUser) {
      throw new BadRequestException('Email sudah terdaftar');
    }

    const existingNim = await this.prisma.studentProfile.findUnique({
      where: { nim: dto.nim },
      select: { id: true },
    });

    if (existingNim) {
      throw new BadRequestException('NIM sudah terdaftar');
    }

    const prodi = await this.prisma.academicUnit.findFirst({
      where: {
        id: dto.prodiId,
        type: 'PRODI',
        isActive: true,
      },
      select: { id: true },
    });

    if (!prodi) {
      throw new BadRequestException('Program studi tidak valid atau tidak aktif');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Registrasi mandiri default untuk mahasiswa. Role struktural dibuat oleh seed/admin.
    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          displayName: dto.displayName.trim(),
          passwordHash: hashedPassword,
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
          role: 'MAHASISWA',
        },
      });

      await tx.studentProfile.create({
        data: {
          userId: createdUser.id,
          nim: dto.nim,
          prodiId: dto.prodiId,
          angkatan: dto.angkatan ?? null,
          kelas: dto.kelas?.trim() || null,
        },
      });

      await tx.emailVerification.delete({ where: { email: normalizedEmail } });

      return createdUser;
    });

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
        displayName: user.displayName,
      },
    };
  }
}
