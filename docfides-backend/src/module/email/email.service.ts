import { Injectable, Logger, Optional } from '@nestjs/common';
import type { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Optional()
    @InjectQueue('email')
    private emailQueue?: Queue,
  ) {}

  /**
   * Queue OTP email untuk dikirim async (non-blocking)
   * Response langsung ke user, email dikirim di background
   *
   * Retry: 3x dengan exponential backoff
   * - 1st retry: 2 detik
   * - 2nd retry: 4 detik
   * - 3rd retry: 8 detik
   */
  async sendOtpEmail(to: string, otp: string): Promise<void> {
    if (!this.emailQueue) {
      this.logger.error('Email queue not configured, cannot send OTP');
      throw new Error('Email service is not properly configured');
    }

    try {
      const job = await this.emailQueue.add(
        'send-otp',
        { to, otp },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false, // Keep failed jobs untuk debug
        },
      );

      this.logger.debug(`OTP email queued for ${to} (Job #${job.id})`);
    } catch (error) {
      this.logger.error(
        `Failed to queue OTP email for ${to}:`,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }
}
