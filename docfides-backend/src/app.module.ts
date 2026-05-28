import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './module/auth/auth.module';
import { PrismaController } from './module/prisma/prisma.controller';
import { PrismaService } from './module/prisma/prisma.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from './module/prisma/prisma.module';
import { EmailModule } from './module/email/email.module';
import { IdentityModule } from './module/identity/identity.module';
import { CertificationModule } from './module/certification/certification.module';
import { AdminModule } from './module/admin/admin.module';
import { PublicModule } from './module/public/public.module';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Scheduling
    ScheduleModule.forRoot(),

    // Redis for caching & rate limiting (optional)
    CacheModule.register({
      isGlobal: true,
      ttl: 60 * 60 * 1000, // 1 hour default TTL
    }),

    // Bull for async job queue
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisHost =
          configService.get<string>('REDIS_HOST') ?? 'localhost';
        const redisPort = configService.get<number>('REDIS_PORT') ?? 6379;
        return {
          redis: {
            host: redisHost,
            port: redisPort,
            maxRetriesPerRequest: null,
          },
        };
      },
    }),

    // Core modules
    AuthModule,
    PrismaModule,
    EmailModule,
    IdentityModule,
    CertificationModule,
    AdminModule,
    PublicModule,
  ],
  controllers: [AppController, PrismaController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
