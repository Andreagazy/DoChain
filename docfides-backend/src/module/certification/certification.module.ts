import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IdentityModule } from '../identity/identity.module';
import { CertificationController } from './certification.controller';
import { CertificationService } from './certification.service';

@Module({
    imports: [PrismaModule, IdentityModule],
    controllers: [CertificationController],
    providers: [CertificationService],
})
export class CertificationModule { }
