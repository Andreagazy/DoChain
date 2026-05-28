import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
