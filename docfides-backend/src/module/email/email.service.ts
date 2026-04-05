/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendOtpEmail(to: string, otp: string): Promise<void> {
    await this.transporter.sendMail({
      from: '"Aplikasi Sertifikasi" <noreply@domain.com>',
      to,
      subject: 'Kode OTP Registrasi',
      text: `Kode OTP Anda adalah: ${otp}`,
      html: `<b>Kode OTP Anda adalah: ${otp}</b>`,
    });
  }
}
