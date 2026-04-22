/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import * as nodemailer from 'nodemailer';

interface SendOtpJobData {
  to: string;
  otp: string;
}

@Processor('email')
@Injectable()
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);
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

    // Test connection
    this.transporter.verify((error) => {
      if (error) {
        this.logger.error('SMTP Connection Error:', error);
      } else {
        this.logger.log('SMTP Server ready to take messages');
      }
    });
  }

  /**
   * Process send OTP email job
   * Retry: 3x dengan exponential backoff (2s, 4s, 8s)
   */
  @Process('send-otp')
  async handleSendOtp(job: Job<SendOtpJobData>) {
    try {
      this.logger.debug(`Processing email job #${job.id} for ${job.data.to}`);

      const { to, otp } = job.data;

      await this.transporter.sendMail({
        from: '"Aplikasi Sertifikasi" <noreply@domain.com>',
        to,
        subject: 'Kode OTP Registrasi - Docfides',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; }
                .header { text-align: center; border-bottom: 2px solid #007bff; padding-bottom: 20px; }
                .content { padding: 20px 0; }
                .otp-box { background-color: #f0f0f0; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; }
                .otp-code { font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 5px; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h2>🔐 Kode OTP Anda</h2>
                </div>
                <div class="content">
                  <p>Halo,</p>
                  <p>Anda telah meminta kode OTP untuk verifikasi email. Gunakan kode berikut untuk menyelesaikan registrasi:</p>
                  <div class="otp-box">
                    <div class="otp-code">${otp}</div>
                  </div>
                  <p><strong>Catatan penting:</strong></p>
                  <ul>
                    <li>Kode OTP berlaku selama <strong>10 menit</strong></li>
                    <li>Jangan bagikan kode ini kepada siapapun</li>
                    <li>Jika Anda tidak melakukan permintaan ini, abaikan email ini</li>
                  </ul>
                </div>
                <div class="footer">
                  <p>Email ini dikirim otomatis. Silakan tidak membalas email ini.</p>
                  <p>&copy; 2026 Docfides. All rights reserved.</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });

      this.logger.log(`✅ Email sent successfully to ${to} (Job #${job.id})`);
      return { success: true, to };
    } catch (error) {
      this.logger.error(
        `❌ Failed to send email to ${job.data.to} (Job #${job.id}):`,
        error instanceof Error ? error.message : error,
      );
      // Throw untuk trigger retry
      throw error;
    }
  }
}
