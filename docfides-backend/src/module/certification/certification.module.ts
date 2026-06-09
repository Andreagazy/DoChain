import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IdentityModule } from '../identity/identity.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { CertificationController } from './certification.controller';
import { CertificationService } from './certification.service';
import { IpfsService } from './ipfs.service';

@Module({
  imports: [PrismaModule, IdentityModule, BlockchainModule],
  controllers: [CertificationController],
  providers: [CertificationService, IpfsService],
})
export class CertificationModule {}
