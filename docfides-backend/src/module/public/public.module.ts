import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PrismaModule } from '../prisma/prisma.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { VerifyPdfSignatureValidationService } from './verify-pdf-signature-validation.service';

@Module({
  imports: [
    PrismaModule,
    BlockchainModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [PublicController],
  providers: [PublicService, VerifyPdfSignatureValidationService],
})
export class PublicModule {}
