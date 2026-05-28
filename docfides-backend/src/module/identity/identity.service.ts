import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitIdentityDto } from './dto/submit-identity.dto';
import { ReviewIdentityDto } from './dto/review-identity.dto';
import { existsSync, readdirSync } from 'fs';
import { relative, resolve } from 'path';

@Injectable()
export class IdentityService {
  constructor(private prisma: PrismaService) {}

  async submitIdentity(
    userId: string,
    dto: SubmitIdentityDto,
    ktpFile?: Express.Multer.File,
  ) {
    const existingNik = await this.prisma.identity.findUnique({
      where: { nik: dto.nik },
      select: { userId: true },
    });

    if (existingNik && existingNik.userId !== userId) {
      throw new BadRequestException('NIK sudah digunakan oleh user lain');
    }

    const existingIdentity = await this.prisma.identity.findUnique({
      where: { userId },
    });

    if (!existingIdentity && !ktpFile) {
      throw new BadRequestException(
        'File KTP wajib diunggah saat submit identitas pertama kali',
      );
    }

    const identity = await this.prisma.identity.upsert({
      where: { userId },
      update: {
        nik: dto.nik,
        fullName: dto.fullName,
        birthPlace: dto.birthPlace,
        birthDate: new Date(dto.birthDate),
        address: dto.address,
        ...(ktpFile && {
          ktpOriginalFileName: ktpFile.originalname,
          ktpStoredFileName: ktpFile.filename,
          ktpStoragePath: relative(process.cwd(), ktpFile.path),
          ktpMimeType: ktpFile.mimetype,
          ktpSizeBytes: ktpFile.size,
          ktpUploadedAt: new Date(),
        }),
        status: 'PENDING',
        verifiedBy: null,
        verifiedAt: null,
      },
      create: {
        userId,
        nik: dto.nik,
        fullName: dto.fullName,
        birthPlace: dto.birthPlace,
        birthDate: new Date(dto.birthDate),
        address: dto.address,
        ...(ktpFile && {
          ktpOriginalFileName: ktpFile.originalname,
          ktpStoredFileName: ktpFile.filename,
          ktpStoragePath: relative(process.cwd(), ktpFile.path),
          ktpMimeType: ktpFile.mimetype,
          ktpSizeBytes: ktpFile.size,
          ktpUploadedAt: new Date(),
        }),
        status: 'PENDING',
      },
      select: {
        userId: true,
        nik: true,
        fullName: true,
        birthPlace: true,
        birthDate: true,
        address: true,
        ktpOriginalFileName: true,
        ktpStoredFileName: true,
        ktpStoragePath: true,
        ktpMimeType: true,
        ktpSizeBytes: true,
        ktpUploadedAt: true,
        status: true,
        updatedAt: true,
      },
    });

    return {
      message: 'Identitas berhasil disubmit dan menunggu verifikasi',
      identity,
      ktpUploaded: Boolean(ktpFile),
      ktpPath: ktpFile?.path ?? null,
    };
  }

  async getMyIdentity(userId: string) {
    const identity = await this.prisma.identity.findUnique({
      where: { userId },
      select: {
        userId: true,
        nik: true,
        fullName: true,
        birthPlace: true,
        birthDate: true,
        address: true,
        ktpOriginalFileName: true,
        ktpStoredFileName: true,
        ktpStoragePath: true,
        ktpMimeType: true,
        ktpSizeBytes: true,
        ktpUploadedAt: true,
        status: true,
        verifiedBy: true,
        verifiedAt: true,
        updatedAt: true,
      },
    });

    if (!identity) {
      return {
        identityExists: false,
        status: 'NOT_SUBMITTED',
      };
    }

    return {
      identityExists: true,
      ...identity,
    };
  }

  async getIdentityStatus(userId: string) {
    const identity = await this.prisma.identity.findUnique({
      where: { userId },
      select: { status: true },
    });

    if (!identity) {
      return {
        status: 'NOT_SUBMITTED',
        canCertify: false,
        reason: 'Identitas belum disubmit',
      };
    }

    return {
      status: identity.status,
      canCertify: identity.status === 'APPROVED',
      reason:
        identity.status === 'APPROVED'
          ? null
          : 'Identitas belum APPROVED sehingga sertifikasi dikunci',
    };
  }

  async getCertificationGate(userId: string) {
    return this.getIdentityStatus(userId);
  }

  async listPendingIdentities(reviewerUserId?: string) {
    const scope = reviewerUserId
      ? await this.getReviewScope(reviewerUserId)
      : { role: 'SUPERADMIN', prodiIds: null };

    return this.prisma.identity.findMany({
      where: {
        status: 'PENDING',
        ...(scope.prodiIds ? { user: this.userScopeWhere(scope.prodiIds) } : {}),
      },
      select: {
        userId: true,
        nik: true,
        fullName: true,
        birthDate: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async reviewIdentity(
    reviewerUserId: string,
    userId: string,
    dto: ReviewIdentityDto,
  ) {
    await this.ensureCanReviewUser(reviewerUserId, userId);

    const identity = await this.prisma.identity.findUnique({
      where: { userId },
      select: { userId: true, status: true },
    });

    if (!identity) {
      throw new NotFoundException('Data identitas tidak ditemukan');
    }

    const updated = await this.prisma.identity.update({
      where: { userId },
      data: {
        status: dto.status,
        verifiedBy: reviewerUserId,
        verifiedAt: new Date(),
      },
      select: {
        userId: true,
        status: true,
        verifiedBy: true,
        verifiedAt: true,
      },
    });

    return {
      message:
        dto.status === 'APPROVED'
          ? 'Identitas berhasil di-approve'
          : `Identitas ditolak${dto.rejectionReason ? `: ${dto.rejectionReason}` : ''}`,
      identity: updated,
    };
  }

  async resolveKtpPath(userId: string): Promise<string> {
    const identity = await this.prisma.identity.findUnique({
      where: { userId },
      select: { ktpStoragePath: true },
    });

    if (identity?.ktpStoragePath) {
      const metadataPath = resolve(process.cwd(), identity.ktpStoragePath);
      if (existsSync(metadataPath)) {
        return metadataPath;
      }
    }

    const uploadRoot = process.env.KTP_UPLOAD_DIR ?? 'uploads/identity';
    const userDir = resolve(process.cwd(), uploadRoot, userId);

    if (!existsSync(userDir)) {
      throw new NotFoundException('File KTP tidak ditemukan');
    }

    const fileName = readdirSync(userDir).find((file) =>
      file.startsWith(`${userId}-ktp`),
    );

    if (!fileName) {
      throw new NotFoundException('File KTP tidak ditemukan');
    }

    const absolutePath = resolve(userDir, fileName);

    if (!existsSync(absolutePath)) {
      throw new NotFoundException('File KTP tidak ditemukan');
    }

    return absolutePath;
  }

  async resolveKtpPathForReviewer(
    reviewerUserId: string,
    targetUserId: string,
  ): Promise<string> {
    await this.ensureCanReviewUser(reviewerUserId, targetUserId);
    return this.resolveKtpPath(targetUserId);
  }

  private async getReviewScope(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        structuralAssignments: {
          where: {
            isActive: true,
            position: 'ADMIN_PRODI',
            academicUnit: { type: 'PRODI', isActive: true },
          },
          select: { academicUnitId: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Reviewer tidak ditemukan');
    }

    if (user.role === 'SUPERADMIN') {
      return { role: user.role, prodiIds: null as string[] | null };
    }

    if (user.role === 'ADMIN_PRODI') {
      return {
        role: user.role,
        prodiIds: user.structuralAssignments.map((assignment) => assignment.academicUnitId),
      };
    }

    throw new BadRequestException('Role tidak memiliki akses review identitas');
  }

  private userScopeWhere(prodiIds: string[]) {
    if (prodiIds.length === 0) {
      return { id: { in: [] } };
    }

    return {
      OR: [
        { studentProfile: { is: { prodiId: { in: prodiIds } } } },
        { employeeProfile: { is: { homeUnitId: { in: prodiIds } } } },
        {
          structuralAssignments: {
            some: {
              academicUnitId: { in: prodiIds },
              isActive: true,
            },
          },
        },
      ],
    };
  }

  private async ensureCanReviewUser(reviewerUserId: string, targetUserId: string) {
    const scope = await this.getReviewScope(reviewerUserId);

    if (!scope.prodiIds) {
      return;
    }

    const target = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        ...this.userScopeWhere(scope.prodiIds),
      },
      select: { id: true },
    });

    if (!target) {
      throw new BadRequestException('User berada di luar prodi yang dikelola');
    }
  }
}
