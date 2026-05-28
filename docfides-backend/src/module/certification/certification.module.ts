import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IdentityModule } from '../identity/identity.module';
import { CertificationController } from './certification.controller';
import { CertificationService } from './certification.service';
import { IpfsService } from './ipfs.service';
import { BlockchainService } from './blockchain.service';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [CertificationController],
  providers: [CertificationService, IpfsService, BlockchainService],
})
export class CertificationModule {}
