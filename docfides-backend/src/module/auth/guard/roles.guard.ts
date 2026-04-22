import {
    CanActivate,
    ExecutionContext,
    Injectable,
    ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../decorator/roles.decorator';

type RequestWithUser = Request & {
    user?: {
        userId: string;
    };
};

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private prisma: PrismaService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredRoles = this.reflector.getAllAndOverride<string[]>(
            ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest<RequestWithUser>();
        const userId = request.user?.userId;

        if (!userId) {
            throw new ForbiddenException('Akses ditolak');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
        });

        if (!user || !requiredRoles.includes(user.role)) {
            throw new ForbiddenException('Anda tidak memiliki izin untuk aksi ini');
        }

        return true;
    }
}
