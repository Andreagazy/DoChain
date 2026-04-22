import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

type RequestWithUser = Request & {
    user?: {
        userId: string;
    };
};

@Injectable()
export class IdentityApprovedGuard implements CanActivate {
    constructor(private prisma: PrismaService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<RequestWithUser>();
        const userId = request.user?.userId;

        if (!userId) {
            throw new ForbiddenException('Akses ditolak');
        }

        const identity = await this.prisma.identity.findUnique({
            where: { userId },
            select: { status: true },
        });

        if (!identity) {
            throw new ForbiddenException(
                'Anda harus mengisi identitas KTP sebelum sertifikasi dokumen',
            );
        }

        if (identity.status !== 'APPROVED') {
            throw new ForbiddenException(
                `Verifikasi identitas Anda masih ${identity.status}. Sertifikasi dokumen belum dapat diakses.`,
            );
        }

        return true;
    }
}
