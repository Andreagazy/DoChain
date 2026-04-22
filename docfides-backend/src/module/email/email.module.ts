import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';
import { EmailCleanupService } from './email-cleanup.service';
import { RateLimitService } from './rate-limit.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'email', // Queue name
    }),
    PrismaModule,
  ],
  providers: [
    EmailService,
    EmailProcessor,
    EmailCleanupService,
    RateLimitService,
  ],
  exports: [EmailService, RateLimitService],
})
export class EmailModule {}
