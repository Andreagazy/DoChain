import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'bcrypt';
import { createHash } from 'crypto';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminUserDto, UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { CreateAcademicUnitDto, UpdateAcademicUnitDto } from './dto/manage-academic-unit.dto';
import { RevokeDocumentDto } from './dto/revoke-document.dto';
import { ReviewIdentityDto } from '../identity/dto/review-identity.dto';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
  ) {}

  async listUsers(requesterUserId?: string) {
    const scope = requesterUserId
      ? await this.getAccessScope(requesterUserId)
      : { role: 'SUPERADMIN', prodiIds: null };
    const users = await this.prisma.user.findMany({
      where: this.userScopeWhere(scope.prodiIds),
      orderBy: [{ role: 'asc' }, { displayName: 'asc' }, { email: 'asc' }],
      select: this.userSelect(),
    });

    return { users: users.map((user) => this.serializeUser(user)) };
  }

  async getOverview(requesterUserId?: string) {
    const scope = requesterUserId
      ? await this.getAccessScope(requesterUserId)
      : { role: 'SUPERADMIN', prodiIds: null };
    const userWhere = this.userScopeWhere(scope.prodiIds);
    const identityWhere = scope.prodiIds
      ? { user: userWhere }
      : {};
    const documentWhere = this.documentScopeWhere(scope.prodiIds);
    const [
      totalUsers,
      activeUsers,
      pendingIdentities,
      pendingIdentityChanges,
      pendingAcademicProfileChanges,
      totalDocuments,
      fullySignedDocuments,
      revokedDocuments,
      declinedSigners,
      roleGroups,
      documentStatusGroups,
    ] = await Promise.all([
      this.prisma.user.count({ where: userWhere }),
      this.prisma.user.count({ where: { ...userWhere, status: 'ACTIVE' } }),
      this.prisma.identity.count({ where: { ...identityWhere, status: 'PENDING' } }),
      this.prisma.identityChangeRequest.count({ where: { ...identityWhere, status: 'PENDING' } }),
      this.prisma.academicProfileChangeRequest.count({ where: { ...identityWhere, status: 'PENDING' } }),
      this.prisma.document.count({ where: documentWhere }),
      this.prisma.document.count({ where: { ...documentWhere, status: 'FULLY_SIGNED' } }),
      this.prisma.document.count({ where: { ...documentWhere, status: 'REVOKED' } }),
      this.prisma.documentSigner.count({
        where: {
          status: 'DECLINED',
          ...(scope.prodiIds
            ? {
                document: documentWhere,
              }
            : {}),
        },
      }),
      this.prisma.user.groupBy({
        by: ['role'],
        where: userWhere,
        _count: { role: true },
      }),
      this.prisma.document.groupBy({
        by: ['status'],
        where: documentWhere,
        _count: { status: true },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        byRole: roleGroups.map((item) => ({
          role: item.role,
          count: item._count.role,
        })),
      },
      identities: {
        pending: pendingIdentities + pendingIdentityChanges,
        pendingAcademicProfileChanges,
      },
      documents: {
        total: totalDocuments,
        fullySigned: fullySignedDocuments,
        revoked: revokedDocuments,
        declinedSigners,
        byStatus: documentStatusGroups.map((item) => ({
          status: item.status,
          count: item._count.status,
        })),
      },
    };
  }

  async getUser(userId: string, requesterUserId?: string) {
    if (requesterUserId) {
      await this.ensureCanAccessUser(requesterUserId, userId);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.userSelect(),
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    return { user: this.serializeUser(user) };
  }

  async createUser(dto: CreateAdminUserDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException('Email sudah terdaftar');
    }

    const passwordHash = await hash(dto.password ?? 'User123!', 10);

    const created = await this.prisma.user.create({
      data: {
        email,
        displayName: dto.displayName.trim(),
        role: dto.role,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        passwordHash,
      },
      select: { id: true },
    });

    await this.updateUser(created.id, {
      studentProfile: dto.studentProfile,
      employeeProfile: dto.employeeProfile,
      structuralAssignments: dto.structuralAssignments,
    });

    return this.getUser(created.id);
  }

  async updateUser(userId: string, dto: UpdateAdminUserDto, requesterUserId?: string) {
    const scope = requesterUserId
      ? await this.getAccessScope(requesterUserId)
      : { role: 'SUPERADMIN', prodiIds: null as string[] | null };
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    if (scope.prodiIds) {
      await this.ensureAdminProdiCanUpdateUser(userId, user.role, dto, scope.prodiIds);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(dto.displayName !== undefined && {
            displayName: dto.displayName?.trim() || null,
          }),
          ...(dto.role !== undefined && { role: dto.role }),
          ...(dto.status !== undefined && { status: dto.status }),
        },
      });

      if (dto.studentProfile !== undefined) {
        if (dto.studentProfile === null) {
          await tx.studentProfile.deleteMany({ where: { userId } });
        } else {
          await this.ensureUnit(dto.studentProfile.prodiId, 'PRODI');
          await tx.studentProfile.upsert({
            where: { userId },
            update: {
              nim: dto.studentProfile.nim,
              prodiId: dto.studentProfile.prodiId,
              angkatan: dto.studentProfile.angkatan ?? null,
              kelas: dto.studentProfile.kelas ?? null,
            },
            create: {
              userId,
              nim: dto.studentProfile.nim,
              prodiId: dto.studentProfile.prodiId,
              angkatan: dto.studentProfile.angkatan ?? null,
              kelas: dto.studentProfile.kelas ?? null,
            },
          });
        }
      }

      if (dto.employeeProfile !== undefined) {
        if (dto.employeeProfile === null) {
          await tx.structuralAssignment.deleteMany({ where: { userId } });
          await tx.employeeProfile.deleteMany({ where: { userId } });
        } else {
          await this.ensureUnit(dto.employeeProfile.homeUnitId);
          await tx.employeeProfile.upsert({
            where: { userId },
            update: {
              nip: dto.employeeProfile.nip || null,
              nidn: dto.employeeProfile.nidn || null,
              employeeType: dto.employeeProfile.employeeType,
              homeUnitId: dto.employeeProfile.homeUnitId,
              positionTitle: dto.employeeProfile.positionTitle || null,
            },
            create: {
              userId,
              nip: dto.employeeProfile.nip || null,
              nidn: dto.employeeProfile.nidn || null,
              employeeType: dto.employeeProfile.employeeType,
              homeUnitId: dto.employeeProfile.homeUnitId,
              positionTitle: dto.employeeProfile.positionTitle || null,
            },
          });
        }
      }

      if (dto.structuralAssignments !== undefined) {
        await tx.structuralAssignment.deleteMany({ where: { userId } });

        for (const assignment of dto.structuralAssignments) {
          await this.ensureUnit(assignment.academicUnitId);
          await tx.structuralAssignment.create({
            data: {
              userId,
              academicUnitId: assignment.academicUnitId,
              position: assignment.position,
              isActive: true,
            },
          });
        }
      }

      if (dto.certificateFullName !== undefined && dto.certificateFullName !== null) {
        const certificateFullName = dto.certificateFullName.trim();

        if (certificateFullName.length < 2) {
          throw new BadRequestException('Nama untuk sertifikat minimal 2 karakter');
        }

        const identity = await tx.identity.findUnique({
          where: { userId },
          select: { id: true },
        });

        if (identity) {
          await tx.identity.update({
            where: { userId },
            data: { fullName: certificateFullName },
          });
        } else {
          await tx.user.update({
            where: { id: userId },
            data: { displayName: certificateFullName },
          });
        }
      }
    });

    return this.getUser(userId);
  }

  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    if (user.role === 'SUPERADMIN') {
      const superadminCount = await this.prisma.user.count({
        where: { role: 'SUPERADMIN', status: 'ACTIVE' },
      });

      if (superadminCount <= 1) {
        throw new BadRequestException('Minimal harus ada satu superadmin aktif');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'DISABLED',
        deletedAt: new Date(),
      },
      select: this.userSelect(),
    });

    return {
      message: 'User berhasil dinonaktifkan',
      user: this.serializeUser(updated),
    };
  }

  async resetUserPassword(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    if (password.trim().length < 8) {
      throw new BadRequestException('Password minimal 8 karakter');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hash(password, 10),
      },
    });

    return { message: 'Password user berhasil direset' };
  }

  async listIdentities(requesterUserId?: string, status?: string) {
    const scope = requesterUserId
      ? await this.getAccessScope(requesterUserId)
      : { role: 'SUPERADMIN', prodiIds: null };
    const allowedStatuses = ['PENDING', 'APPROVED', 'REJECTED'] as const;
    const normalizedStatus = status?.trim().toUpperCase();

    if (normalizedStatus && !allowedStatuses.includes(normalizedStatus as typeof allowedStatuses[number])) {
      throw new BadRequestException('Status identitas tidak valid');
    }

    const identities = await this.prisma.identity.findMany({
      where: {
        ...(scope.prodiIds ? { user: this.userScopeWhere(scope.prodiIds) } : {}),
        ...(normalizedStatus ? { status: normalizedStatus as typeof allowedStatuses[number] } : {}),
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      select: {
        userId: true,
        nik: true,
        fullName: true,
        birthPlace: true,
        birthDate: true,
        address: true,
        ktpOriginalFileName: true,
        ktpStoragePath: true,
        status: true,
        verifiedBy: true,
        verifiedAt: true,
        updatedAt: true,
        user: {
          select: {
            email: true,
            displayName: true,
            role: true,
            status: true,
          },
        },
      },
    });

    return { identities };
  }

  async reviewIdentity(
    reviewerUserId: string,
    userId: string,
    dto: ReviewIdentityDto,
  ) {
    await this.ensureCanAccessUser(reviewerUserId, userId);

    const identity = await this.prisma.identity.findUnique({
      where: { userId },
      select: { userId: true },
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

  async listAcademicProfileChangeRequests(requesterUserId: string) {
    const scope = await this.getAccessScope(requesterUserId);

    const requests = await this.prisma.academicProfileChangeRequest.findMany({
      where: {
        status: 'PENDING',
        ...(scope.prodiIds ? { user: this.userScopeWhere(scope.prodiIds) } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        nim: true,
        angkatan: true,
        kelas: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        prodi: {
          select: { id: true, code: true, name: true, type: true },
        },
        user: {
          select: {
            email: true,
            displayName: true,
            role: true,
            identity: {
              select: { fullName: true },
            },
            studentProfile: {
              select: {
                nim: true,
                angkatan: true,
                kelas: true,
                prodi: { select: { id: true, code: true, name: true, type: true } },
              },
            },
          },
        },
      },
    });

    return { requests };
  }

  async reviewAcademicProfileChangeRequest(
    reviewerUserId: string,
    requestId: string,
    dto: ReviewIdentityDto,
  ) {
    const request = await this.prisma.academicProfileChangeRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        userId: true,
        nim: true,
        prodiId: true,
        angkatan: true,
        kelas: true,
        status: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Request perubahan profil akademik tidak ditemukan');
    }

    await this.ensureCanAccessUser(reviewerUserId, request.userId);

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Request perubahan profil akademik sudah diproses');
    }

    if (dto.status === 'APPROVED') {
      await this.ensureUnit(request.prodiId, 'PRODI');

      const existingNim = await this.prisma.studentProfile.findUnique({
        where: { nim: request.nim },
        select: { userId: true },
      });

      if (existingNim && existingNim.userId !== request.userId) {
        throw new BadRequestException('NIM sudah digunakan oleh mahasiswa lain');
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.studentProfile.update({
          where: { userId: request.userId },
          data: {
            nim: request.nim,
            prodiId: request.prodiId,
            angkatan: request.angkatan,
            kelas: request.kelas,
          },
        });

        await tx.academicProfileChangeRequest.update({
          where: { id: request.id },
          data: {
            status: 'APPROVED',
            reviewedById: reviewerUserId,
            reviewedAt: new Date(),
            rejectionReason: null,
          },
        });
      });

      return { message: 'Perubahan profil akademik berhasil di-approve' };
    }

    await this.prisma.academicProfileChangeRequest.update({
      where: { id: request.id },
      data: {
        status: 'REJECTED',
        reviewedById: reviewerUserId,
        reviewedAt: new Date(),
        rejectionReason:
          dto.rejectionReason?.trim() || 'Data profil akademik tidak valid',
      },
    });

    return {
      message: `Perubahan profil akademik ditolak${dto.rejectionReason ? `: ${dto.rejectionReason}` : ''}`,
    };
  }

  async listAcademicUnits(requesterUserId?: string) {
    const scope = requesterUserId
      ? await this.getAccessScope(requesterUserId)
      : { role: 'SUPERADMIN', prodiIds: null as string[] | null };
    const units = await this.prisma.academicUnit.findMany({
      where: scope.prodiIds ? { id: { in: scope.prodiIds }, isActive: true } : {},
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        parentId: true,
        isActive: true,
      },
    });

    return { units };
  }

  async getAcademicUnit(unitId: string) {
    const unit = await this.prisma.academicUnit.findUnique({
      where: { id: unitId },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        parentId: true,
        isActive: true,
      },
    });

    if (!unit) {
      throw new NotFoundException('Unit akademik tidak ditemukan');
    }

    return { unit };
  }

  async createAcademicUnit(dto: CreateAcademicUnitDto) {
    if (dto.type === 'PRODI' && !dto.parentId) {
      throw new BadRequestException('Prodi wajib memiliki parent jurusan');
    }

    if (dto.parentId) {
      await this.ensureUnit(dto.parentId, 'JURUSAN');
    }

    const unit = await this.prisma.academicUnit.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        type: dto.type,
        parentId: dto.parentId ?? null,
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        parentId: true,
        isActive: true,
      },
    });

    return { unit };
  }

  async updateAcademicUnit(unitId: string, dto: UpdateAcademicUnitDto) {
    const existing = await this.prisma.academicUnit.findUnique({
      where: { id: unitId },
      select: { id: true, type: true },
    });

    if (!existing) {
      throw new NotFoundException('Unit akademik tidak ditemukan');
    }

    if (dto.parentId) {
      await this.ensureUnit(dto.parentId, 'JURUSAN');
    }

    if (existing.type === 'PRODI' && dto.parentId === null) {
      throw new BadRequestException('Prodi wajib memiliki parent jurusan');
    }

    const unit = await this.prisma.academicUnit.update({
      where: { id: unitId },
      data: {
        ...(dto.code !== undefined && { code: dto.code.trim().toUpperCase() }),
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        parentId: true,
        isActive: true,
      },
    });

    return { unit };
  }

  async deleteAcademicUnit(unitId: string) {
    const existing = await this.prisma.academicUnit.findUnique({
      where: { id: unitId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Unit akademik tidak ditemukan');
    }

    const unit = await this.prisma.academicUnit.update({
      where: { id: unitId },
      data: { isActive: false },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        parentId: true,
        isActive: true,
      },
    });

    return {
      message: 'Unit akademik berhasil dinonaktifkan',
      unit,
    };
  }

  async listDocuments(requesterUserId?: string) {
    const scope = requesterUserId
      ? await this.getAccessScope(requesterUserId)
      : { role: 'SUPERADMIN', prodiIds: null };
    const documents = await this.prisma.document.findMany({
      where: this.documentScopeWhere(scope.prodiIds),
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        originalFileName: true,
        finalFileName: true,
        status: true,
        finalFileHash: true,
        finalFileIpfsHash: true,
        revokedAt: true,
        revokeReason: true,
        createdAt: true,
        updatedAt: true,
        revokedBy: {
          select: {
            email: true,
            displayName: true,
            role: true,
          },
        },
        user: {
          select: {
            email: true,
            displayName: true,
          },
        },
        requiredSigners: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
          select: {
            status: true,
            order: true,
            signedAt: true,
            declinedAt: true,
            declineReason: true,
            user: {
              select: {
                email: true,
                displayName: true,
                role: true,
              },
            },
          },
        },
      },
    });

    return { documents };
  }

  async revokeDocument(
    revokedById: string,
    documentId: string,
    dto: RevokeDocumentDto,
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, status: true, finalFileHash: true },
    });

    if (!document) {
      throw new NotFoundException('Dokumen tidak ditemukan');
    }

    if (document.status === 'REVOKED') {
      throw new BadRequestException('Dokumen sudah berstatus REVOKED');
    }

    if (!document.finalFileHash) {
      throw new BadRequestException(
        'Dokumen belum memiliki hash final sehingga belum bisa dicabut dari blockchain',
      );
    }

    await this.blockchainService.revokeDocument(document.finalFileHash, dto.reason);

    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedById,
        revokeReason: dto.reason,
      },
      select: {
        id: true,
        originalFileName: true,
        finalFileName: true,
        status: true,
        finalFileHash: true,
        finalFileIpfsHash: true,
        revokedAt: true,
        revokeReason: true,
        createdAt: true,
        updatedAt: true,
        revokedBy: {
          select: {
            email: true,
            displayName: true,
            role: true,
          },
        },
        user: {
          select: {
            email: true,
            displayName: true,
          },
        },
        requiredSigners: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
          select: {
            status: true,
            order: true,
            signedAt: true,
            declinedAt: true,
            declineReason: true,
            user: {
              select: {
                email: true,
                displayName: true,
                role: true,
              },
            },
          },
        },
      },
    });

    return {
      message: 'Dokumen berhasil dicabut',
      document: updated,
    };
  }

  async getDocumentFile(requesterUserId: string, documentId: string) {
    const scope = await this.getAccessScope(requesterUserId);
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        ...this.documentScopeWhere(scope.prodiIds),
      },
      select: {
        id: true,
        userId: true,
        originalFileName: true,
        originalFileHash: true,
        finalFileName: true,
        finalFileHash: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Dokumen tidak ditemukan');
    }

    const path = this.resolveDocumentPath(document.userId, {
      finalFileName: document.finalFileName,
      originalFileName: document.originalFileName,
      finalFileHash: document.finalFileHash,
      originalFileHash: document.originalFileHash,
    });

    return {
      fileName: this.buildSignedPdfFileName(document.originalFileName),
      content: readFileSync(path),
    };
  }

  private buildSignedPdfFileName(originalFileName: string | null) {
    const fallbackName = 'dokumen';
    const baseName = (originalFileName ?? fallbackName)
      .replace(/\.pdf$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    const safeBaseName =
      baseName
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
        .replace(/\.+$/g, '')
        .replace(/-+/g, '-')
        .trim() || fallbackName;

    return `${safeBaseName}-signed.pdf`;
  }

  private async ensureUnit(unitId: string, type?: 'JURUSAN' | 'PRODI') {
    const unit = await this.prisma.academicUnit.findUnique({
      where: { id: unitId },
      select: { id: true, type: true, isActive: true },
    });

    if (!unit || !unit.isActive) {
      throw new BadRequestException('Unit akademik tidak valid');
    }

    if (type && unit.type !== type) {
      throw new BadRequestException(`Unit akademik harus bertipe ${type}`);
    }
  }

  private resolveDocumentPath(
    userId: string | null,
    names: {
      finalFileName: string | null;
      originalFileName: string | null;
      finalFileHash: string | null;
      originalFileHash: string | null;
    },
  ): string {
    const documentRoot = resolve(
      process.cwd(),
      process.env.DOCUMENT_UPLOAD_DIR ?? 'uploads/documents',
    );
    const signedRoot = resolve(
      process.cwd(),
      process.env.SIGNED_DOCUMENT_DIR ?? 'uploads/signed-documents',
    );
    const candidates = [names.finalFileName, names.originalFileName].filter(
      (name): name is string => Boolean(name),
    );
    const userIds = userId ? [userId] : [];

    for (const candidate of candidates) {
      const direct = resolve(process.cwd(), candidate);
      if (existsSync(direct)) {
        return direct;
      }

      for (const ownerId of userIds) {
        const signedUserScoped = resolve(signedRoot, ownerId, candidate);
        if (existsSync(signedUserScoped)) {
          return signedUserScoped;
        }

        const userScoped = resolve(documentRoot, ownerId, candidate);
        if (existsSync(userScoped)) {
          return userScoped;
        }
      }

      const signedRootScoped = resolve(signedRoot, candidate);
      if (existsSync(signedRootScoped)) {
        return signedRootScoped;
      }

      const rootScoped = resolve(documentRoot, candidate);
      if (existsSync(rootScoped)) {
        return rootScoped;
      }
    }

    const fallbackHashes = [names.finalFileHash, names.originalFileHash].filter(
      (value): value is string => Boolean(value),
    );

    for (const hashValue of fallbackHashes) {
      for (const ownerId of userIds) {
        const fromSignedUserScope = this.findDocumentPathByHash(
          resolve(signedRoot, ownerId),
          hashValue,
        );
        if (fromSignedUserScope) {
          return fromSignedUserScope;
        }

        const fromUserScope = this.findDocumentPathByHash(
          resolve(documentRoot, ownerId),
          hashValue,
        );
        if (fromUserScope) {
          return fromUserScope;
        }
      }

      const fromSignedRootScope = this.findDocumentPathByHash(signedRoot, hashValue);
      if (fromSignedRootScope) {
        return fromSignedRootScope;
      }

      const fromRootScope = this.findDocumentPathByHash(documentRoot, hashValue);
      if (fromRootScope) {
        return fromRootScope;
      }
    }

    throw new NotFoundException('File dokumen tidak ditemukan');
  }

  private findDocumentPathByHash(
    directoryPath: string,
    expectedHash: string,
  ): string | null {
    if (!existsSync(directoryPath)) {
      return null;
    }

    const entries = readdirSync(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = resolve(directoryPath, entry.name);
      if (entry.isDirectory()) {
        const nested = this.findDocumentPathByHash(absolutePath, expectedHash);
        if (nested) {
          return nested;
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      try {
        const content = readFileSync(absolutePath);
        const hashValue = createHash('sha256').update(content).digest('hex');
        if (hashValue === expectedHash) {
          return absolutePath;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private async getAccessScope(userId: string) {
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
      throw new NotFoundException('User tidak ditemukan');
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

    throw new BadRequestException('Role tidak memiliki akses admin');
  }

  private userScopeWhere(prodiIds: string[] | null) {
    if (!prodiIds) {
      return {};
    }

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

  private documentScopeWhere(prodiIds: string[] | null) {
    if (!prodiIds) {
      return {};
    }

    if (prodiIds.length === 0) {
      return { id: { in: [] } };
    }

    const scopedUserWhere = this.userScopeWhere(prodiIds);

    return {
      OR: [
        { user: scopedUserWhere },
        {
          requiredSigners: {
            some: {
              user: scopedUserWhere,
            },
          },
        },
      ],
    };
  }

  private async ensureCanAccessUser(requesterUserId: string, targetUserId: string) {
    const scope = await this.getAccessScope(requesterUserId);

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

  private async ensureAdminProdiCanUpdateUser(
    targetUserId: string,
    targetRole: string,
    dto: UpdateAdminUserDto,
    prodiIds: string[],
  ) {
    if (!['MAHASISWA', 'DOSEN'].includes(targetRole)) {
      throw new BadRequestException(
        'Admin prodi hanya dapat mengedit profil mahasiswa atau dosen dalam prodi yang dikelola',
      );
    }

    if (
      dto.role !== undefined ||
      dto.status !== undefined ||
      dto.certificateFullName !== undefined ||
      dto.structuralAssignments !== undefined
    ) {
      throw new BadRequestException(
        'Admin prodi tidak dapat mengubah role, status, nama sertifikat, atau jabatan struktural user',
      );
    }

    const target = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        ...this.userScopeWhere(prodiIds),
      },
      select: { id: true },
    });

    if (!target) {
      throw new BadRequestException('User berada di luar prodi yang dikelola');
    }

    if (targetRole === 'MAHASISWA') {
      if (dto.employeeProfile !== undefined) {
        throw new BadRequestException('Profil mahasiswa tidak boleh diisi sebagai dosen');
      }

      if (dto.studentProfile === null) {
        throw new BadRequestException('Admin prodi tidak dapat menghapus profil mahasiswa');
      }

      if (dto.studentProfile && !prodiIds.includes(dto.studentProfile.prodiId)) {
        throw new BadRequestException('Program studi berada di luar prodi yang dikelola');
      }
    }

    if (targetRole === 'DOSEN') {
      if (dto.studentProfile !== undefined) {
        throw new BadRequestException('Profil dosen tidak boleh diisi sebagai mahasiswa');
      }

      if (dto.employeeProfile === null) {
        throw new BadRequestException('Admin prodi tidak dapat menghapus profil dosen');
      }

      if (dto.employeeProfile && !prodiIds.includes(dto.employeeProfile.homeUnitId)) {
        throw new BadRequestException('Home unit berada di luar prodi yang dikelola');
      }
    }
  }

  private userSelect() {
    return {
      id: true,
      email: true,
      displayName: true,
      role: true,
      status: true,
      emailVerifiedAt: true,
      createdAt: true,
      identity: { select: { status: true, fullName: true, nik: true } },
      studentProfile: {
        select: {
          nim: true,
          angkatan: true,
          kelas: true,
          prodi: { select: { id: true, code: true, name: true, type: true } },
        },
      },
      employeeProfile: {
        select: {
          nip: true,
          nidn: true,
          employeeType: true,
          positionTitle: true,
          homeUnit: { select: { id: true, code: true, name: true, type: true } },
        },
      },
      structuralAssignments: {
        where: { isActive: true },
        select: {
          position: true,
          academicUnit: { select: { id: true, code: true, name: true, type: true } },
        },
      },
    } as const;
  }

  private serializeUser(user: ReturnType<AdminService['userSelect']> extends infer _ ? any : never) {
    return user;
  }
}
