import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './module/auth/auth.module';
import { PrismaController } from './module/prisma/prisma.controller';
import { PrismaService } from './module/prisma/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './module/prisma/prisma.module';

@Module({
  imports: [AuthModule, PrismaModule, ConfigModule.forRoot({ isGlobal: true })],
  controllers: [AppController, PrismaController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
