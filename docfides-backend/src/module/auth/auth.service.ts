/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { addMinutes } from 'date-fns';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

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

  async login(user: any) {
    const payload = { sub: user.id, email: user.email };
    return { access_token: this.jwtService.sign(payload) };
  }

  // --- Fungsi untuk registrasi dengan OTP ---
  private generateOtp(): string {
    return randomInt(100000, 999999).toString();
  }

  async requestOtp(email: string): Promise<void> {
    // Cek apakah email sudah terdaftar sebagai user
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new BadRequestException('Email sudah terdaftar');
    }

    const otp = this.generateOtp();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiresAt = addMinutes(new Date(), 10); // berlaku 10 menit

    await this.prisma.emailVerification.upsert({
      where: { email },
      update: {
        otp: hashedOtp,
        expiresAt,
        verified: false,
        createdAt: new Date(),
      },
      create: {
        email,
        otp: hashedOtp,
        expiresAt,
      },
    });

    // Kirim email
    try {
      await this.emailService.sendOtpEmail(email, otp);
    } catch (error) {
      console.log(error);
      // Hapus record jika gagal kirim email (opsional)
      await this.prisma.emailVerification
        .delete({ where: { email } })
        .catch(() => {});
      throw new BadRequestException('Gagal mengirim email, coba lagi');
    }
  }

  async verifyOtp(email: string, otp: string): Promise<{ message: string }> {
    const record = await this.prisma.emailVerification.findUnique({
      where: { email },
    });

    if (!record) {
      throw new BadRequestException('Tidak ada permintaan OTP untuk email ini');
    }

    if (record.verified) {
      throw new BadRequestException('Email sudah diverifikasi');
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException('OTP sudah kadaluarsa');
    }

    const valid = await bcrypt.compare(otp, record.otp);

    if (!valid) {
      throw new BadRequestException('OTP salah');
    }

    await this.prisma.emailVerification.update({
      where: { email },
      data: { verified: true },
    });

    return { message: 'OTP valid, silakan lanjutkan registrasi' };
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
      },
    };
  }
}
