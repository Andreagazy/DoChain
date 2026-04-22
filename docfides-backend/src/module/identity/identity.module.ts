import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { RolesGuard } from '../auth/guard/roles.guard';
import { IdentityApprovedGuard } from './guard/identity-approved.guard';

@Module({
    imports: [PrismaModule],
    controllers: [IdentityController],
    providers: [IdentityService, RolesGuard, IdentityApprovedGuard],
    exports: [IdentityService, IdentityApprovedGuard],
})
export class IdentityModule { }
