import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { extname, resolve } from 'path';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { PDFDocument } from 'pdf-lib';
import * as forge from 'node-forge';
import * as QRCode from 'qrcode';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { plainAddPlaceholder } from '@signpdf/placeholder-plain';
import signpdf from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import { PrismaService } from '../prisma/prisma.service';
import { SignDocumentDto, SignatureMode } from './dto/sign-document.dto';
import { RequestSignersDto } from './dto/request-signers.dto';
import { DeclineDocumentDto } from './dto/decline-document.dto';
import { UpdateSignaturePreferenceDto } from './dto/update-signature-preference.dto';
import { FinalizeQrDto } from './dto/finalize-qr.dto';
import { RequestDocumentRevokeDto } from './dto/request-document-revoke.dto';
import { IpfsService } from './ipfs.service';
import { BlockchainService } from '../blockchain/blockchain.service';

type SignerPlaceholderConfig = {
  visiblePage: number | null;
  visibleX: number | null;
  visibleY: number | null;
  visibleWidth: number | null;
  visibleHeight: number | null;
};

type SignerMembershipForSign = {
  status: string;
  order: number | null;
} & SignerPlaceholderConfig;

type SignDocumentQueryResult = {
  id: string;
  userId: string | null;
  status: string;
  originalFileName: string | null;
  originalFileHash: string | null;
  finalFileName: string | null;
  finalFileHash: string | null;
  qrCodePage: number | null;
  qrCodeX: number | null;
  qrCodeY: number | null;
  qrCodeWidth: number | null;
  qrCodeHeight: number | null;
  _count: {
    requiredSigners: number;
    signatures: number;
  };
  requiredSigners: SignerMembershipForSign[];
};

const SIGNER_ROLE_RANK: Record<string, number> = {
  MAHASISWA: 10,
  DOSEN: 20,
  ADMIN_PRODI: 30,
  PRODI: 40,
  JURUSAN: 50,
  SUPERADMIN: 60,
};

const DEFAULT_QR_CODE_SIZE = 48;

@Injectable()
export class CertificationService {
  private readonly logger = new Logger(CertificationService.name);

  constructor(
    private prisma: PrismaService,
    private ipfsService: IpfsService,
    private blockchainService: BlockchainService,
  ) {}

  private async buildUniqueOriginalFileName(
    userId: string,
    originalName: string,
  ): Promise<string> {
    const trimmedName = originalName.trim();
    const fallbackName = trimmedName || 'document.pdf';

    const extension = extname(fallbackName);
    const baseName = extension
      ? fallbackName.slice(0, -extension.length)
      : fallbackName;

    const escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedExt = extension.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const similarNames = await this.prisma.document.findMany({
      where: {
        userId,
        originalFileName: {
          startsWith: baseName,
        },
      },
      select: {
        originalFileName: true,
      },
    });

    const usedIndexes = new Set<number>();
    const duplicatePattern = extension
      ? new RegExp(`^${escapedBase} \\((\\d+)\\)${escapedExt}$`)
      : new RegExp(`^${escapedBase} \\((\\d+)\\)$`);

    for (const item of similarNames) {
      const existingName = item.originalFileName;
      if (!existingName) {
        continue;
      }

      if (existingName === fallbackName) {
        usedIndexes.add(0);
        continue;
      }

      const match = existingName.match(duplicatePattern);
      if (match) {
        usedIndexes.add(Number(match[1]));
      }
    }

    if (!usedIndexes.has(0)) {
      return fallbackName;
    }

    let index = 1;
    while (usedIndexes.has(index)) {
      index += 1;
    }

    return extension
      ? `${baseName} (${index})${extension}`
      : `${baseName} (${index})`;
  }

  async uploadDocument(userId: string, documentFile: Express.Multer.File) {
    if (!documentFile) {
      throw new BadRequestException('File dokumen wajib diunggah');
    }

    const hash = this.sha256Hex(readFileSync(documentFile.path));
    const uniqueOriginalFileName = await this.buildUniqueOriginalFileName(
      userId,
      documentFile.originalname,
    );

    return this.prisma.document.create({
      data: {
        userId,
        originalFileName: uniqueOriginalFileName,
        originalFileHash: hash,
        originalFileSize: documentFile.size,
        status: 'DRAFT',
      },
      select: {
        id: true,
        status: true,
        originalFileName: true,
        originalFileSize: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async listMyDocuments(userId: string) {
    const documents = await this.prisma.document.findMany({
      where: {
        OR: [
          { userId },
          {
            requiredSigners: {
              some: {
                userId,
              },
            },
          },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        userId: true,
        status: true,
        originalFileName: true,
        finalFileName: true,
        finalFileIpfsHash: true,
        qrCodePage: true,
        updatedAt: true,
        _count: {
          select: {
            requiredSigners: true,
            signatures: true,
          },
        },
        requiredSigners: {
          where: {
            userId,
          },
          select: {
            status: true,
            order: true,
          },
        },
      },
    });

    return {
      documents: documents.map((item) => ({
        id: item.id,
        accessType: item.userId === userId ? 'OWNER' : 'SIGNER',
        signerStatus: item.requiredSigners[0]?.status ?? null,
        signerOrder: item.requiredSigners[0]?.order ?? null,
        status: item.status,
        originalFileName: item.originalFileName,
        finalFileName: item._count.signatures > 0 ? item.finalFileName : null,
        finalFileIpfsHash:
          item._count.signatures > 0 ? item.finalFileIpfsHash : null,
        finalFileIpfsGatewayUrl:
          item._count.signatures > 0
            ? this.ipfsService.getGatewayUrl(item.finalFileIpfsHash)
            : null,
        hasVerificationQr: item.qrCodePage != null,
        requiredSignerCount: item._count.requiredSigners,
        signatureCount: item._count.signatures,
        updatedAt: item.updatedAt,
      })),
    };
  }

  async deleteDraftDocument(userId: string, documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        userId: true,
        status: true,
        originalFileName: true,
        originalFileHash: true,
        finalFileName: true,
        finalFileHash: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Dokumen tidak ditemukan');
    }

    if (document.userId !== userId) {
      throw new BadRequestException('Hanya pemilik dokumen yang dapat menghapus draft');
    }

    if (document.status !== 'DRAFT') {
      throw new BadRequestException('Hanya dokumen draft yang dapat dihapus');
    }

    let removedFile = false;
    try {
      const documentPath = this.resolveDocumentPath(userId, {
        finalFileName: document.finalFileName,
        originalFileName: document.originalFileName,
        finalFileHash: document.finalFileHash,
        originalFileHash: document.originalFileHash,
      });

      if (existsSync(documentPath)) {
        unlinkSync(documentPath);
        removedFile = true;
      }
    } catch (err) {
      if (!(err instanceof NotFoundException)) {
        this.logger.warn(
          `File draft dokumen ${documentId} gagal dihapus: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    await this.prisma.document.delete({
      where: { id: documentId },
    });

    return {
      message: removedFile
        ? 'Dokumen draft berhasil dihapus'
        : 'Data dokumen draft berhasil dihapus',
    };
  }

  async getIpfsStatus() {
    return this.ipfsService.getStatus();
  }

  async getIpfsFile(cid: string) {
    return this.ipfsService.fetchFile(cid);
  }

  async listNotifications(userId: string) {
    const [assignedDocuments, ownerDocuments] = await Promise.all([
      this.prisma.documentSigner.findMany({
        where: {
          userId,
          status: 'PENDING',
          document: {
            status: {
              in: ['PENDING_SIGNATURES', 'PARTIALLY_SIGNED'],
            },
          },
        },
        orderBy: [{ order: 'asc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          order: true,
          updatedAt: true,
          document: {
            select: {
              id: true,
              status: true,
              originalFileName: true,
              finalFileName: true,
              user: {
                select: {
                  displayName: true,
                  email: true,
                  identity: {
                    select: {
                      fullName: true,
                    },
                  },
                },
              },
              requiredSigners: {
                orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
                select: {
                  userId: true,
                  status: true,
                  order: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.document.findMany({
        where: {
          userId,
          OR: [
            { status: 'FULLY_SIGNED' },
            { status: 'REVOKED' },
            {
              requiredSigners: {
                some: {
                  status: 'DECLINED',
                },
              },
            },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          status: true,
          originalFileName: true,
          finalFileName: true,
          updatedAt: true,
          requiredSigners: {
            where: {
              status: 'DECLINED',
            },
            take: 1,
            select: {
              declineReason: true,
              user: {
                select: {
                  displayName: true,
                  email: true,
                  identity: {
                    select: {
                      fullName: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const actionableAssignments = assignedDocuments.filter((assignment) => {
      const currentOrder = assignment.order ?? Number.MAX_SAFE_INTEGER;
      return assignment.document.requiredSigners.every((signer) => {
        const signerOrder = signer.order ?? Number.MAX_SAFE_INTEGER;
        return (
          signer.userId === userId ||
          signerOrder >= currentOrder ||
          signer.status === 'SIGNED'
        );
      });
    });

    const signNotifications = actionableAssignments.map((assignment) => {
      const documentTitle =
        assignment.document.originalFileName ??
        assignment.document.finalFileName ??
        'Dokumen PDF';
      const ownerName =
        assignment.document.user?.identity?.fullName ??
        assignment.document.user?.displayName ??
        assignment.document.user?.email ??
        'Pemilik dokumen';

      return {
        id: `sign-${assignment.id}`,
        type: 'SIGN_REQUIRED',
        priority: 'HIGH',
        title: 'Dokumen perlu ditandatangani',
        description: `${documentTitle} dari ${ownerName} menunggu tanda tangan Anda.`,
        href: '/certification/assigned',
        documentId: assignment.document.id,
        documentTitle,
        createdAt: assignment.updatedAt,
      };
    });

    const ownerNotifications = ownerDocuments.map((document) => {
      const documentTitle =
        document.originalFileName ?? document.finalFileName ?? 'Dokumen PDF';
      const declinedSigner = document.requiredSigners[0];
      const declinedSignerName = declinedSigner
        ? (declinedSigner.user.identity?.fullName ??
          declinedSigner.user.displayName ??
          declinedSigner.user.email)
        : null;

      if (declinedSigner) {
        return {
          id: `declined-${document.id}`,
          type: 'DOCUMENT_DECLINED',
          priority: 'HIGH',
          title: 'Dokumen ditolak penandatangan',
          description: `${documentTitle} ditolak${declinedSignerName ? ` oleh ${declinedSignerName}` : ''}.`,
          href: `/documents/${document.id}`,
          documentId: document.id,
          documentTitle,
          createdAt: document.updatedAt,
        };
      }

      if (document.status === 'REVOKED') {
        return {
          id: `revoked-${document.id}`,
          type: 'DOCUMENT_REVOKED',
          priority: 'MEDIUM',
          title: 'Dokumen dicabut',
          description: `${documentTitle} sudah dicabut dan tidak berlaku lagi.`,
          href: `/documents/${document.id}`,
          documentId: document.id,
          documentTitle,
          createdAt: document.updatedAt,
        };
      }

      return {
        id: `final-${document.id}`,
        type: 'DOCUMENT_FINAL',
        priority: 'MEDIUM',
        title: 'Dokumen sudah final',
        description: `${documentTitle} sudah selesai ditandatangani.`,
        href: `/documents/${document.id}`,
        documentId: document.id,
        documentTitle,
        createdAt: document.updatedAt,
      };
    });

    const notifications = [...signNotifications, ...ownerNotifications]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 10);

    return {
      unreadCount: signNotifications.length,
      actionRequiredCount: signNotifications.length,
      notifications,
    };
  }

  async listAssignedDocuments(userId: string) {
    const assignments = await this.prisma.documentSigner.findMany({
      where: {
        userId,
      },
      orderBy: [{ status: 'asc' }, { order: 'asc' }, { updatedAt: 'desc' }],
      select: {
        status: true,
        order: true,
        updatedAt: true,
        visiblePage: true,
        visibleX: true,
        visibleY: true,
        visibleWidth: true,
        visibleHeight: true,
        document: {
          select: {
            id: true,
            status: true,
            originalFileName: true,
            finalFileName: true,
            user: {
              select: {
                email: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    return {
      assignments: assignments.map((item) => ({
        signerStatus: item.status,
        order: item.order,
        updatedAt: item.updatedAt,
        placeholder: {
          visiblePage: item.visiblePage,
          visibleX: item.visibleX,
          visibleY: item.visibleY,
          visibleWidth: item.visibleWidth,
          visibleHeight: item.visibleHeight,
        },
        document: {
          id: item.document.id,
          status: item.document.status,
          originalFileName: item.document.originalFileName,
          finalFileName: item.document.finalFileName,
          ownerEmail: item.document.user?.email ?? null,
          ownerDisplayName: item.document.user?.displayName ?? null,
        },
      })),
    };
  }

  async getDocumentDetail(userId: string, documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        userId: true,
        status: true,
        originalFileName: true,
        finalFileName: true,
        originalFileSize: true,
        finalFileSize: true,
        qrCodePage: true,
        revokedAt: true,
        revokeReason: true,
        createdAt: true,
        updatedAt: true,
        revokeRequests: {
          where: { requesterId: userId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            reason: true,
            status: true,
            reviewNote: true,
            reviewedAt: true,
            createdAt: true,
            evidences: {
              select: {
                id: true,
                originalFileName: true,
                mimeType: true,
                sizeBytes: true,
              },
            },
          },
        },
        user: {
          select: {
            email: true,
            displayName: true,
            identity: {
              select: {
                fullName: true,
              },
            },
          },
        },
        requiredSigners: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
          select: {
            userId: true,
            status: true,
            order: true,
            signedAt: true,
            declinedAt: true,
            declineReason: true,
            updatedAt: true,
            user: {
              select: {
                email: true,
                displayName: true,
                role: true,
                identity: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
            signature: {
              select: {
                id: true,
                order: true,
                signedAt: true,
              },
            },
          },
        },
        signatures: {
          orderBy: [{ order: 'asc' }, { signedAt: 'asc' }],
          select: {
            id: true,
            order: true,
            signedAt: true,
            signerId: true,
            signer: {
              select: {
                email: true,
                displayName: true,
                role: true,
                identity: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            requiredSigners: true,
            signatures: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Dokumen tidak ditemukan');
    }

    const isOwner = document.userId === userId;
    const isAssignedSigner = document.requiredSigners.some(
      (signer) => signer.userId === userId,
    );

    if (!isOwner && !isAssignedSigner) {
      throw new NotFoundException(
        'Dokumen tidak ditemukan atau bukan akses Anda',
      );
    }

    return {
      document: {
        id: document.id,
        status: document.status,
        originalFileName: document.originalFileName,
        finalFileName: document.finalFileName,
        originalFileSize: document.originalFileSize,
        finalFileSize: document.finalFileSize,
        hasVerificationQr: document.qrCodePage != null,
        revokedAt: document.revokedAt,
        revokeReason: document.revokeReason,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        owner: {
          email: document.user?.email ?? null,
          displayName: document.user?.displayName ?? null,
          fullName: document.user?.identity?.fullName ?? null,
        },
        requiredSignerCount: document._count.requiredSigners,
        signatureCount: document._count.signatures,
      },
      signingProcess: document.requiredSigners.map((signer) => ({
        userId: signer.userId,
        order: signer.order,
        status: signer.status,
        signedAt: signer.signedAt,
        declinedAt: signer.declinedAt,
        declineReason: signer.declineReason,
        updatedAt: signer.updatedAt,
        signer: {
          email: signer.user.email,
          displayName: signer.user.displayName,
          fullName: signer.user.identity?.fullName ?? null,
          role: signer.user.role,
        },
        signature: signer.signature
          ? {
              id: signer.signature.id,
              order: signer.signature.order,
              signedAt: signer.signature.signedAt,
            }
          : null,
      })),
      signatures: document.signatures.map((signature) => ({
        id: signature.id,
        order: signature.order,
        signedAt: signature.signedAt,
        signerId: signature.signerId,
        signer: {
          email: signature.signer.email,
          displayName: signature.signer.displayName,
          fullName: signature.signer.identity?.fullName ?? null,
          role: signature.signer.role,
        },
      })),
      revokeRequests: document.revokeRequests,
    };
  }

  async requestDocumentRevoke(
    userId: string,
    documentId: string,
    dto: RequestDocumentRevokeDto,
    evidenceFiles: Express.Multer.File[],
  ) {
    const reason = dto.reason?.trim();
    if (!reason || reason.length < 10) {
      throw new BadRequestException('Alasan pencabutan minimal 10 karakter');
    }

    if (!evidenceFiles || evidenceFiles.length < 2) {
      throw new BadRequestException('Minimal upload 2 gambar bukti pencabutan');
    }

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        userId: true,
        status: true,
        requiredSigners: {
          select: { userId: true },
        },
        signatures: {
          select: { signerId: true },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Dokumen tidak ditemukan');
    }

    const isOwner = document.userId === userId;
    const isRequiredSigner = document.requiredSigners.some(
      (signer) => signer.userId === userId,
    );
    const hasSigned = document.signatures.some(
      (signature) => signature.signerId === userId,
    );

    if (!isOwner && !isRequiredSigner && !hasSigned) {
      throw new NotFoundException(
        'Dokumen tidak ditemukan atau bukan wewenang Anda',
      );
    }

    if (document.status !== 'FULLY_SIGNED') {
      throw new BadRequestException(
        'Request pencabutan hanya dapat diajukan untuk dokumen final',
      );
    }

    const existingPending = await this.prisma.documentRevokeRequest.findFirst({
      where: {
        documentId,
        requesterId: userId,
        status: 'PENDING',
      },
      select: { id: true },
    });

    if (existingPending) {
      throw new BadRequestException(
        'Masih ada request pencabutan yang menunggu review',
      );
    }

    const request = await this.prisma.documentRevokeRequest.create({
      data: {
        documentId,
        requesterId: userId,
        reason,
        evidences: {
          create: evidenceFiles.map((file) => ({
            originalFileName: file.originalname,
            storedFileName: file.filename,
            storagePath: file.path,
            mimeType: file.mimetype,
            sizeBytes: file.size,
          })),
        },
      },
      select: {
        id: true,
        reason: true,
        status: true,
        createdAt: true,
        evidences: {
          select: {
            id: true,
            originalFileName: true,
            mimeType: true,
            sizeBytes: true,
          },
        },
      },
    });

    return {
      message: 'Request pencabutan dokumen berhasil diajukan',
      request,
    };
  }

  async getDocumentFileForPreview(userId: string, documentId: string) {
    return this.getDocumentFileByVariant(userId, documentId, 'latest');
  }

  async getOriginalDocumentFile(userId: string, documentId: string) {
    return this.getDocumentFileByVariant(userId, documentId, 'original');
  }

  async getSignedDocumentFile(userId: string, documentId: string) {
    return this.getDocumentFileByVariant(userId, documentId, 'signed');
  }

  async getSignerPlaceholders(userId: string, documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Dokumen tidak ditemukan');
    }

    if (document.userId !== userId) {
      throw new BadRequestException(
        'Hanya pemilik dokumen yang dapat melihat placeholder signer',
      );
    }

    const signers = await this.prisma.documentSigner.findMany({
      where: {
        documentId,
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: {
        userId: true,
        order: true,
        status: true,
        visiblePage: true,
        visibleX: true,
        visibleY: true,
        visibleWidth: true,
        visibleHeight: true,
        user: {
          select: {
            email: true,
            displayName: true,
            identity: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    return {
      documentId,
      signers: signers.map((item) => ({
        userId: item.userId,
        order: item.order,
        status: item.status,
        email: item.user?.email ?? null,
        displayName: item.user?.displayName ?? null,
        fullName: item.user?.identity?.fullName ?? null,
        placeholder: {
          visiblePage: item.visiblePage,
          visibleX: item.visibleX,
          visibleY: item.visibleY,
          visibleWidth: item.visibleWidth,
          visibleHeight: item.visibleHeight,
        },
      })),
    };
  }

  private async getDocumentFileByVariant(
    userId: string,
    documentId: string,
    variant: 'latest' | 'original' | 'signed',
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        userId: true,
        originalFileName: true,
        originalFileHash: true,
        finalFileName: true,
        finalFileHash: true,
        qrCodePage: true,
        qrCodeX: true,
        qrCodeY: true,
        qrCodeWidth: true,
        qrCodeHeight: true,
        _count: {
          select: {
            signatures: true,
          },
        },
        requiredSigners: {
          where: { userId },
          select: { id: true },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Dokumen tidak ditemukan');
    }

    const isOwner = document.userId === userId;
    const isAssignedSigner = document.requiredSigners.length > 0;

    if (!isOwner && !isAssignedSigner) {
      throw new BadRequestException('Anda tidak memiliki akses ke dokumen ini');
    }

    const documentStorageOwnerId = document.userId ?? userId;

    if (
      variant === 'signed' &&
      (!document.finalFileName ||
        !document.finalFileHash ||
        document._count.signatures === 0)
    ) {
      throw new BadRequestException(
        'Dokumen belum memiliki versi bertanda tangan',
      );
    }

    const path =
      variant === 'original'
        ? this.resolveDocumentPath(documentStorageOwnerId, {
            finalFileName: null,
            originalFileName: document.originalFileName,
            finalFileHash: null,
            originalFileHash: document.originalFileHash,
          })
        : variant === 'signed'
          ? this.resolveDocumentPath(documentStorageOwnerId, {
              finalFileName: document.finalFileName,
              originalFileName: null,
              finalFileHash: document.finalFileHash,
              originalFileHash: null,
            })
          : this.resolveDocumentPath(documentStorageOwnerId, {
              finalFileName: document.finalFileName,
              originalFileName: document.originalFileName,
              finalFileHash: document.finalFileHash,
              originalFileHash: document.originalFileHash,
            });

    const fileName =
      variant === 'original'
        ? (document.originalFileName ?? `${document.id}.pdf`)
        : variant === 'signed'
          ? this.buildSignedPdfFileName(document.originalFileName)
          : (document.finalFileName ??
            document.originalFileName ??
            `${document.id}.pdf`);

    return {
      fileName,
      content: readFileSync(path),
    };
  }

  async listSignerCandidates(userId: string) {
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        status: 'ACTIVE',
        identity: {
          is: {
            status: 'APPROVED',
          },
        },
      },
      orderBy: [{ displayName: 'asc' }, { email: 'asc' }],
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        preferredSignatureMode: true,
        identity: {
          select: {
            fullName: true,
          },
        },
        studentProfile: {
          select: {
            nim: true,
            prodi: { select: { code: true, name: true } },
          },
        },
        employeeProfile: {
          select: {
            nip: true,
            nidn: true,
            positionTitle: true,
            homeUnit: { select: { code: true, name: true, type: true } },
          },
        },
        structuralAssignments: {
          where: { isActive: true, endsAt: null },
          select: {
            position: true,
            academicUnit: { select: { code: true, name: true, type: true } },
          },
        },
      },
    });

    users.sort((a, b) => {
      const rankA = SIGNER_ROLE_RANK[a.role] ?? 999;
      const rankB = SIGNER_ROLE_RANK[b.role] ?? 999;
      return (
        rankA - rankB ||
        (a.identity?.fullName ?? a.displayName ?? a.email).localeCompare(
          b.identity?.fullName ?? b.displayName ?? b.email,
        )
      );
    });

    return {
      signers: users.map((user) => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        fullName: user.identity?.fullName ?? null,
        certificateName:
          user.identity?.fullName ?? user.displayName ?? user.email,
        role: user.role,
        signerLevel: SIGNER_ROLE_RANK[user.role] ?? 999,
        academicProfile: this.buildSignerAcademicProfile(user),
        preferredSignatureMode: 'visible',
      })),
    };
  }

  async getSignatureStatus(userId: string) {
    const signaturePath = this.resolveSignatureImagePath(userId);
    if (!signaturePath) {
      return {
        hasSignature: false,
        signature: null,
        preferredSignatureMode: 'visible',
      };
    }

    return {
      hasSignature: true,
      signature: {
        fileName: signaturePath.split(/[\\/]/).pop() ?? null,
        storagePath: signaturePath,
      },
      preferredSignatureMode: 'visible',
    };
  }

  getSignatureImageFile(userId: string) {
    const signaturePath = this.resolveSignatureImagePath(userId);

    if (!signaturePath) {
      throw new NotFoundException('Tanda tangan belum tersedia');
    }

    const fileName = signaturePath.split(/[\\/]/).pop() ?? 'signature.png';
    const extension = extname(fileName).toLowerCase();
    const mimeType =
      extension === '.jpg' || extension === '.jpeg'
        ? 'image/jpeg'
        : 'image/png';

    return {
      fileName,
      mimeType,
      content: readFileSync(signaturePath),
    };
  }

  async updateSignaturePreference(
    userId: string,
    dto: UpdateSignaturePreferenceDto,
  ) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        preferredSignatureMode: 'VISIBLE',
      },
      select: {
        id: true,
        preferredSignatureMode: true,
        updatedAt: true,
      },
    });

    return {
      message: 'Preferensi signature berhasil disimpan',
      userId: updated.id,
      preferredSignatureMode: updated.preferredSignatureMode.toLowerCase(),
      updatedAt: updated.updatedAt,
    };
  }

  async requestSigners(
    requesterUserId: string,
    documentId: string,
    dto: RequestSignersDto,
  ) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        userId: true,
        status: true,
        originalFileName: true,
        originalFileHash: true,
        finalFileName: true,
        finalFileHash: true,
        qrCodePage: true,
        _count: {
          select: {
            signatures: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Dokumen tidak ditemukan');
    }

    if (document.userId !== requesterUserId) {
      throw new BadRequestException(
        'Hanya pemilik dokumen yang dapat meminta signer',
      );
    }

    if (document.status === 'REVOKED') {
      throw new BadRequestException(
        'Dokumen REVOKED tidak dapat meminta signer',
      );
    }

    if (document._count.signatures > 0) {
      throw new BadRequestException(
        'Signer dan posisi tanda tangan tidak dapat diubah setelah proses tanda tangan dimulai.',
      );
    }

    const signerIds = Array.from(
      new Set(dto.signerUserIds.map((id) => id.trim()).filter(Boolean)),
    );

    if (signerIds.length === 0) {
      throw new BadRequestException('Daftar signer tidak boleh kosong');
    }

    const placeholderMap = new Map<string, SignerPlaceholderConfig>();

    for (const item of dto.placeholders ?? []) {
      if (!signerIds.includes(item.signerUserId)) {
        throw new BadRequestException(
          `Placeholder signer tidak valid: ${item.signerUserId}`,
        );
      }

      if (placeholderMap.has(item.signerUserId)) {
        throw new BadRequestException(
          `Placeholder signer duplikat: ${item.signerUserId}`,
        );
      }

      placeholderMap.set(item.signerUserId, {
        visiblePage: item.visiblePage ?? null,
        visibleX: item.visibleX ?? null,
        visibleY: item.visibleY ?? null,
        visibleWidth: item.visibleWidth ?? null,
        visibleHeight: item.visibleHeight ?? null,
      });
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: signerIds },
        status: 'ACTIVE',
        identity: {
          is: {
            status: 'APPROVED',
          },
        },
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        preferredSignatureMode: true,
        identity: {
          select: {
            fullName: true,
          },
        },
        studentProfile: {
          select: {
            nim: true,
            prodi: { select: { code: true, name: true } },
          },
        },
        employeeProfile: {
          select: {
            nip: true,
            nidn: true,
            positionTitle: true,
            homeUnit: { select: { code: true, name: true, type: true } },
          },
        },
        structuralAssignments: {
          where: { isActive: true, endsAt: null },
          select: {
            position: true,
            academicUnit: { select: { code: true, name: true, type: true } },
          },
        },
      },
    });

    if (users.length !== signerIds.length) {
      const foundIds = new Set(users.map((user) => user.id));
      const missing = signerIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `User signer tidak ditemukan: ${missing.join(', ')}`,
      );
    }

    const userById = new Map(users.map((user) => [user.id, user]));
    const requestedIndexById = new Map(
      signerIds.map((signerId, index) => [signerId, index]),
    );
    signerIds.sort((a, b) => {
      const userA = userById.get(a);
      const userB = userById.get(b);
      const rankA = SIGNER_ROLE_RANK[userA?.role ?? ''] ?? 999;
      const rankB = SIGNER_ROLE_RANK[userB?.role ?? ''] ?? 999;

      return (
        rankA - rankB ||
        (requestedIndexById.get(a) ?? 999) - (requestedIndexById.get(b) ?? 999)
      );
    });

    const existingSigners = await this.prisma.documentSigner.findMany({
      where: {
        documentId,
        userId: { in: signerIds },
      },
      select: {
        id: true,
        userId: true,
        status: true,
        order: true,
      },
    });

    const existingByUserId = new Map(
      existingSigners.map((signer) => [signer.userId, signer]),
    );

    const requestedSignersWithMode = signerIds.map((userId) => ({
      userId,
      preferredSignatureMode: 'VISIBLE' as const,
    }));

    // Validate visible signature assets before mutating signer rows. This keeps
    // a failed "Lanjut" from leaving stale signers in the next step.
    const visibleSignerIds = requestedSignersWithMode.map(
      (item) => item.userId,
    );

    const missingSignatureImages = visibleSignerIds.filter(
      (signerUserId) => !this.resolveSignatureImagePath(signerUserId),
    );

    if (missingSignatureImages.length > 0) {
      const missingSignerNames = missingSignatureImages.map((signerUserId) => {
        const signer = userById.get(signerUserId);
        return (
          signer?.identity?.fullName ??
          signer?.displayName ??
          signer?.email ??
          'Signer'
        );
      });

      throw new BadRequestException(
        `Tanda tangan belum tersedia untuk: ${missingSignerNames.join(', ')}. Minta signer tersebut membuka menu Tanda Tangan dan menyimpan tanda tangannya terlebih dahulu.`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const processed = [] as Array<{
        userId: string;
        status: string;
        order: number | null;
        action: 'invited' | 're-requested' | 'already-exists' | 'updated';
        placeholder: SignerPlaceholderConfig;
      }>;

      const omittedExistingSigners = await tx.documentSigner.findMany({
        where: {
          documentId,
          userId: { notIn: signerIds },
        },
        select: {
          id: true,
          status: true,
        },
      });

      const signedOmittedSigner = omittedExistingSigners.find(
        (signer) => signer.status === 'SIGNED',
      );
      if (signedOmittedSigner) {
        throw new BadRequestException(
          'Signer yang sudah menandatangani tidak dapat dihapus dari daftar penandatangan.',
        );
      }

      const removableSignerIds = omittedExistingSigners
        .map((signer) => signer.id);

      if (removableSignerIds.length > 0) {
        await tx.documentSigner.deleteMany({
          where: {
            id: { in: removableSignerIds },
          },
        });
      }

      for (const [index, signerUserId] of signerIds.entries()) {
        const existingSigner = existingByUserId.get(signerUserId);
        const requestedOrder = index + 1;
        const requestedPlaceholder =
          placeholderMap.get(signerUserId) ?? this.emptyPlaceholder();

        if (!existingSigner) {
          const created = await tx.documentSigner.create({
            data: {
              documentId,
              userId: signerUserId,
              status: 'PENDING',
              order: requestedOrder,
              ...requestedPlaceholder,
            },
            select: {
              userId: true,
              status: true,
              order: true,
            },
          });

          processed.push({
            userId: created.userId,
            status: created.status,
            order: created.order,
            action: 'invited',
            placeholder: requestedPlaceholder,
          });
          continue;
        }

        if (
          existingSigner.status === 'SIGNED' &&
          existingSigner.order !== requestedOrder
        ) {
          throw new BadRequestException(
            'Urutan signer yang sudah SIGNED tidak dapat diubah',
          );
        }

        if (existingSigner.status === 'DECLINED') {
          const updated = await tx.documentSigner.update({
            where: { id: existingSigner.id },
            data: {
              status: 'PENDING',
              signedAt: null,
              signatureId: null,
              order: requestedOrder,
              ...requestedPlaceholder,
            },
            select: {
              userId: true,
              status: true,
              order: true,
            },
          });

          processed.push({
            userId: updated.userId,
            status: updated.status,
            order: updated.order,
            action: 're-requested',
            placeholder: requestedPlaceholder,
          });

          continue;
        }

        if (existingSigner.status !== 'SIGNED') {
          const updated = await tx.documentSigner.update({
            where: { id: existingSigner.id },
            data: {
              order: requestedOrder,
              ...requestedPlaceholder,
            },
            select: {
              userId: true,
              status: true,
              order: true,
            },
          });

          processed.push({
            userId: updated.userId,
            status: updated.status,
            order: updated.order,
            action: 'updated',
            placeholder: requestedPlaceholder,
          });
          continue;
        }

        processed.push({
          userId: existingSigner.userId,
          status: existingSigner.status,
          order: existingSigner.order,
          action: 'already-exists',
          placeholder: this.emptyPlaceholder(),
        });
      }

      const shouldMoveToPending = document.status === 'DRAFT';
      const updatedDocument = shouldMoveToPending
        ? await tx.document.update({
            where: { id: documentId },
            data: { status: 'PENDING_SIGNATURES' },
            select: {
              id: true,
              status: true,
              updatedAt: true,
            },
          })
        : await tx.document.findUniqueOrThrow({
            where: { id: documentId },
            select: {
              id: true,
              status: true,
              updatedAt: true,
            },
          });

      return {
        processed,
        document: updatedDocument,
      };
    });

    // Pre-render all visible signature appearances to prevent breaking incremental signing
    const sourceDocumentPath = this.resolveDocumentPath(
      document.userId ?? requesterUserId,
      {
        finalFileName: null,
        originalFileName: document.originalFileName ?? `${documentId}.pdf`,
        finalFileHash: null,
        originalFileHash: document.originalFileHash,
      },
    );

    const sourcePdfBuffer = readFileSync(sourceDocumentPath);
    const qrPlacement = await this.buildAutomaticQrPlacement(
      sourcePdfBuffer,
      result.processed.find((item) => item.placeholder.visiblePage != null)
        ?.placeholder ??
        result.processed[0]?.placeholder ??
        null,
    );
    const qrRenderedBuffer = Buffer.from(
      await this.renderVerificationQrCode(
        sourcePdfBuffer,
        documentId,
        qrPlacement,
      ),
    );
    const preRenderedBuffer = await this.preRenderAllVisibleAppearances(
      qrRenderedBuffer,
      documentId,
      requestedSignersWithMode,
    );

    if (preRenderedBuffer.length > 0) {
      const documentRoot = resolve(
        process.cwd(),
        process.env.DOCUMENT_UPLOAD_DIR ?? 'uploads/documents',
      );
      const userDir = resolve(documentRoot, document.userId ?? requesterUserId);
      mkdirSync(userDir, { recursive: true });

      const preRenderedFileName = `${documentId}-pre-rendered.pdf`;
      const preRenderedPath = resolve(userDir, preRenderedFileName);
      writeFileSync(preRenderedPath, preRenderedBuffer);

      const preRenderedHash = this.sha256Hex(preRenderedBuffer);

      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          finalFileName: preRenderedFileName,
          finalFileHash: preRenderedHash,
          finalFileSize: preRenderedBuffer.length,
          finalFileIpfsHash: null,
          qrCodePage: qrPlacement.qrCodePage,
          qrCodeX: qrPlacement.qrCodeX,
          qrCodeY: qrPlacement.qrCodeY,
          qrCodeWidth: qrPlacement.qrCodeWidth,
          qrCodeHeight: qrPlacement.qrCodeHeight,
        },
      });
    }

    return {
      message: 'Permintaan tanda tangan berhasil dikirim',
      document: result.document,
      signers: result.processed.map((item) => {
        const user = users.find((candidate) => candidate.id === item.userId);
        return {
          userId: item.userId,
          email: user?.email ?? null,
          displayName: user?.displayName ?? null,
          fullName: user?.identity?.fullName ?? null,
          certificateName:
            user?.identity?.fullName ??
            user?.displayName ??
            user?.email ??
            null,
          role: user?.role ?? null,
          signerLevel: user?.role ? (SIGNER_ROLE_RANK[user.role] ?? 999) : null,
          academicProfile: user ? this.buildSignerAcademicProfile(user) : null,
          preferredSignatureMode: 'visible',
          status: item.status,
          order: item.order,
          action: item.action,
          placeholder: item.placeholder,
        };
      }),
    };
  }

  uploadSignatureImage(userId: string, signatureFile: Express.Multer.File) {
    if (!signatureFile) {
      throw new BadRequestException('File tanda tangan wajib diunggah');
    }

    const signatureDirectory = resolve(signatureFile.path, '..');
    const currentSignaturePath = resolve(
      signatureDirectory,
      signatureFile.filename,
    );

    for (const entry of readdirSync(signatureDirectory)) {
      if (!entry.startsWith(`${userId}-signature`)) {
        continue;
      }

      const entryPath = resolve(signatureDirectory, entry);
      if (entryPath === currentSignaturePath) {
        continue;
      }

      if (existsSync(entryPath)) {
        unlinkSync(entryPath);
      }
    }

    return {
      message: 'Tanda tangan berhasil diunggah',
      signature: {
        originalFileName: signatureFile.originalname,
        storedFileName: signatureFile.filename,
        mimeType: signatureFile.mimetype,
        sizeBytes: signatureFile.size,
        storagePath: signatureFile.path,
      },
      userId,
    };
  }

  async getEligibility(userId: string, documentId: string) {
    const document = (await this.prisma.document.findUnique({
      where: {
        id: documentId,
      },
      select: {
        id: true,
        userId: true,
        status: true,
        originalFileName: true,
        updatedAt: true,
        _count: {
          select: {
            requiredSigners: true,
            signatures: true,
          },
        },
        requiredSigners: {
          where: { userId },
          select: {
            userId: true,
            status: true,
          },
        },
      },
    })) as SignDocumentQueryResult | null;

    if (!document) {
      throw new NotFoundException(
        'Dokumen tidak ditemukan atau bukan milik Anda',
      );
    }

    const isOwner = document.userId === userId;
    const requiredSignersCount = document._count.requiredSigners;
    const isAssignedSigner = document.requiredSigners.length > 0;

    const canSign = requiredSignersCount > 0 ? isAssignedSigner : isOwner;

    return {
      canStartCertification: document.status !== 'REVOKED',
      canSignCertification: canSign,
      reason:
        document.status === 'REVOKED'
          ? 'Dokumen berstatus REVOKED dan tidak bisa disertifikasi'
          : null,
      document,
    };
  }

  async startCertification(userId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        userId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!document) {
      throw new NotFoundException(
        'Dokumen tidak ditemukan atau bukan milik Anda',
      );
    }

    if (document.status === 'REVOKED') {
      throw new BadRequestException(
        'Dokumen REVOKED tidak dapat disertifikasi',
      );
    }

    const updated =
      document.status === 'DRAFT'
        ? await this.prisma.document.update({
            where: { id: document.id },
            data: { status: 'PENDING_SIGNATURES' },
            select: {
              id: true,
              status: true,
              updatedAt: true,
            },
          })
        : document;

    return {
      message: 'Sertifikasi dokumen dimulai',
      document: updated,
    };
  }

  async signDocument(userId: string, documentId: string, dto: SignDocumentDto) {
    await this.ensureIdentityApproved(userId);

    const document = await this.prisma.document.findUnique({
      where: {
        id: documentId,
      },
      select: {
        id: true,
        userId: true,
        status: true,
        originalFileName: true,
        originalFileHash: true,
        finalFileName: true,
        finalFileHash: true,
        qrCodePage: true,
        qrCodeX: true,
        qrCodeY: true,
        qrCodeWidth: true,
        qrCodeHeight: true,
        _count: {
          select: {
            requiredSigners: true,
            signatures: true,
          },
        },
        requiredSigners: {
          where: { userId },
          select: {
            id: true,
            status: true,
            order: true,
            visiblePage: true,
            visibleX: true,
            visibleY: true,
            visibleWidth: true,
            visibleHeight: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException(
        'Dokumen tidak ditemukan atau bukan milik Anda',
      );
    }

    if (document.status === 'REVOKED') {
      throw new BadRequestException(
        'Dokumen REVOKED tidak dapat ditandatangani',
      );
    }

    const requiredSignersCount = Number(document._count.requiredSigners ?? 0);
    const signerMembership =
      (document.requiredSigners[0] as SignerMembershipForSign | undefined) ??
      null;
    const isOwner = document.userId === userId;

    if (requiredSignersCount > 0 && !signerMembership) {
      throw new BadRequestException(
        'Anda tidak termasuk signer yang diminta untuk dokumen ini',
      );
    }

    if (requiredSignersCount === 0 && !isOwner) {
      throw new BadRequestException(
        'Anda tidak memiliki izin menandatangani dokumen ini',
      );
    }

    if (signerMembership?.status === 'SIGNED') {
      throw new BadRequestException('Anda sudah menandatangani dokumen ini');
    }

    if (signerMembership?.status === 'DECLINED') {
      throw new BadRequestException('Anda sudah menolak dokumen ini');
    }

    if (requiredSignersCount > 0) {
      const nextPendingSigner = await this.prisma.documentSigner.findFirst({
        where: {
          documentId,
          status: 'PENDING',
        },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: {
          userId: true,
          order: true,
        },
      });

      if (nextPendingSigner && nextPendingSigner.userId !== userId) {
        throw new BadRequestException(
          `Dokumen harus ditandatangani sesuai urutan. Menunggu signer urutan ${nextPendingSigner.order ?? '-'} terlebih dahulu.`,
        );
      }
    }

    const documentStorageOwnerId = document.userId ?? userId;

    const sourceDocumentPath = this.resolveDocumentPath(
      documentStorageOwnerId,
      {
        finalFileName: document.finalFileName,
        originalFileName: document.originalFileName,
        finalFileHash: document.finalFileHash,
        originalFileHash: document.originalFileHash,
      },
    );

    const existingSigner = await this.prisma.documentSigner.findUnique({
      where: {
        documentId_userId: {
          documentId,
          userId,
        },
      },
      select: {
        id: true,
        status: true,
        order: true,
      },
    });

    if (existingSigner?.status === 'SIGNED') {
      throw new BadRequestException('Anda sudah menandatangani dokumen ini');
    }

    const [totalRequiredSignersBeforeSign, pendingSignersBeforeSign] =
      await Promise.all([
        this.prisma.documentSigner.count({
          where: { documentId },
        }),
        this.prisma.documentSigner.count({
          where: {
            documentId,
            status: { not: 'SIGNED' },
          },
        }),
      ]);

    const pendingSignersAfterSign =
      pendingSignersBeforeSign - (existingSigner ? 1 : 0);

    const sourcePdfBuffer = readFileSync(sourceDocumentPath);
    const { p12Data, passphrase, certificateId } =
      await this.getOrCreateCertificate(userId);

    const signatureImagePath = this.resolveSignatureImagePath(userId);
    if (!signatureImagePath) {
      throw new BadRequestException(
        'Tanda tangan visible belum tersedia. Silakan setup tanda tangan terlebih dahulu.',
      );
    }

    let effectiveSignDto = this.resolveSignPayloadBySigner(
      { ...dto, mode: SignatureMode.VISIBLE },
      signerMembership,
    );

    let sourceBufferForSigning = Buffer.from(sourcePdfBuffer);

    if (document.qrCodePage == null) {
      if (Number(document._count.signatures ?? 0) > 0) {
        throw new BadRequestException(
          'Dokumen ini belum memiliki QR otomatis dan sudah memiliki signature. Ulangi konfigurasi signer sebelum melanjutkan.',
        );
      }

      const qrPlacement = await this.buildAutomaticQrPlacement(
        sourceBufferForSigning,
        {
          visiblePage: effectiveSignDto.visiblePage ?? null,
          visibleX: effectiveSignDto.visibleX ?? null,
          visibleY: effectiveSignDto.visibleY ?? null,
          visibleWidth: effectiveSignDto.visibleWidth ?? null,
          visibleHeight: effectiveSignDto.visibleHeight ?? null,
        },
      );
      sourceBufferForSigning = Buffer.from(
        await this.renderVerificationQrCode(
          sourceBufferForSigning,
          documentId,
          qrPlacement,
        ),
      );
      effectiveSignDto = {
        ...effectiveSignDto,
        mode: SignatureMode.VISIBLE,
      };

      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          qrCodePage: qrPlacement.qrCodePage,
          qrCodeX: qrPlacement.qrCodeX,
          qrCodeY: qrPlacement.qrCodeY,
          qrCodeWidth: qrPlacement.qrCodeWidth,
          qrCodeHeight: qrPlacement.qrCodeHeight,
        },
      });
    }

    if (
      effectiveSignDto.mode === SignatureMode.VISIBLE &&
      Number(document._count.signatures ?? 0) === 0
    ) {
      sourceBufferForSigning = Buffer.from(
        await this.renderVisibleSignatureAppearance(
          sourceBufferForSigning,
          effectiveSignDto,
          signatureImagePath,
          userId,
        ),
      );
    }

    const preparedPdf = this.preparePdfForIncrementalSigning(
      sourceBufferForSigning,
      effectiveSignDto,
      userId,
    );

    const signer = new P12Signer(p12Data, { passphrase });
    const signedPdfBuffer = await signpdf.sign(preparedPdf, signer, new Date());

    const signedOutput = this.saveSignedDocument(
      documentStorageOwnerId,
      document.originalFileName,
      signedPdfBuffer,
    );
    const signedHash = this.sha256Hex(signedPdfBuffer);
    const shouldFinalizeDocument =
      totalRequiredSignersBeforeSign === 0 || pendingSignersAfterSign === 0;

    const maxOrder = await this.prisma.signature.aggregate({
      where: { documentId },
      _max: { order: true },
    });
    const nextOrder = (maxOrder._max.order ?? 0) + 1;

    const transactionResult = await this.prisma.$transaction(async (tx) => {
      const createdSignature = await tx.signature.create({
        data: {
          documentId,
          signerId: userId,
          certificateId,
          signedFileHash: signedHash,
          order: nextOrder,
        },
        select: {
          id: true,
          order: true,
          signedAt: true,
        },
      });

      if (existingSigner) {
        await tx.documentSigner.update({
          where: { id: existingSigner.id },
          data: {
            status: 'SIGNED',
            signedAt: new Date(),
            signatureId: createdSignature.id,
            ...(existingSigner.order == null ? { order: nextOrder } : {}),
          },
        });
      } else {
        await tx.documentSigner.create({
          data: {
            documentId,
            userId,
            status: 'SIGNED',
            signedAt: new Date(),
            signatureId: createdSignature.id,
            order: nextOrder,
          },
        });
      }

      const nextStatus =
        totalRequiredSignersBeforeSign === 0 || pendingSignersAfterSign === 0
          ? 'FULLY_SIGNED'
          : 'PARTIALLY_SIGNED';

      const updatedDocument = await tx.document.update({
        where: { id: documentId },
        data: {
          status: nextStatus,
          finalFileName: signedOutput.fileName,
          finalFileHash: signedHash,
          finalFileSize: signedOutput.sizeBytes,
          finalFileIpfsHash: null,
          blockchainTxHash: null,
        },
        select: {
          id: true,
          status: true,
          finalFileName: true,
          finalFileHash: true,
          finalFileIpfsHash: true,
          blockchainTxHash: true,
          finalFileSize: true,
          updatedAt: true,
        },
      });

      return {
        signature: createdSignature,
        document: updatedDocument,
      };
    });

    if (shouldFinalizeDocument) {
      this.recordFinalDocumentProofInBackground(
        documentId,
        signedHash,
        signedPdfBuffer,
        signedOutput.fileName,
      );
    }

    return {
      message: 'Dokumen berhasil ditandatangani secara digital',
      mode: effectiveSignDto.mode,
      signedFile: {
        fileName: signedOutput.fileName,
        storagePath: signedOutput.absolutePath,
        hash: signedHash,
        ipfsHash: null,
        ipfsGatewayUrl: null,
        blockchainTxHash: null,
        sizeBytes: signedOutput.sizeBytes,
      },
      ...transactionResult,
    };
  }

  private recordFinalDocumentProofInBackground(
    documentId: string,
    documentHash: string,
    pdfBuffer: Buffer,
    fileName: string,
  ) {
    void this.recordFinalDocumentProof(
      documentId,
      documentHash,
      pdfBuffer,
      fileName,
    );
  }

  private async recordFinalDocumentProof(
    documentId: string,
    documentHash: string,
    pdfBuffer: Buffer,
    fileName: string,
  ) {
    let ipfsCid: string | null = null;

    try {
      const ipfsResult = await this.ipfsService.addPdf(pdfBuffer, fileName);
      ipfsCid = ipfsResult?.cid ?? null;
    } catch (err) {
      this.logger.warn(
        `Upload IPFS final document ${documentId} gagal: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
    }

    let blockchainTxHash: string | null = null;

    try {
      const blockchainResult =
        await this.blockchainService.recordFinalDocumentHash(
          documentHash,
          ipfsCid,
        );
      blockchainTxHash = blockchainResult?.txHash ?? null;
    } catch (err) {
      this.logger.warn(
        `Pencatatan blockchain final document ${documentId} gagal: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
    }

    try {
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          finalFileIpfsHash: ipfsCid,
          blockchainTxHash,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Update proof final document ${documentId} gagal: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
    }
  }

  async finalizeQr(userId: string, documentId: string, dto: FinalizeQrDto) {
    await this.ensureIdentityApproved(userId);

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        userId: true,
        status: true,
        originalFileName: true,
        originalFileHash: true,
        finalFileName: true,
        finalFileHash: true,
        qrCodePage: true,
        _count: {
          select: {
            signatures: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Dokumen tidak ditemukan');
    }

    if (document.userId !== userId) {
      throw new BadRequestException(
        'Hanya pemilik dokumen yang dapat menentukan QR verifikasi',
      );
    }

    if (document.status === 'REVOKED') {
      throw new BadRequestException(
        'Dokumen REVOKED tidak dapat diberi QR verifikasi',
      );
    }

    if (document._count.signatures > 0) {
      throw new BadRequestException(
        'QR verifikasi harus ditempatkan sebelum tanda tangan pertama agar signature tetap valid',
      );
    }

    if (!['DRAFT', 'PENDING_SIGNATURES'].includes(document.status)) {
      throw new BadRequestException(
        'QR verifikasi hanya dapat ditempatkan sebelum proses tanda tangan dimulai',
      );
    }

    if (document.qrCodePage != null) {
      throw new BadRequestException('Dokumen sudah memiliki QR verifikasi');
    }

    const sourceDocumentPath = this.resolveDocumentPath(document.userId, {
      finalFileName: document.finalFileName,
      originalFileName: document.originalFileName,
      finalFileHash: document.finalFileHash,
      originalFileHash: document.originalFileHash,
    });

    const qrWidth = dto.width ?? DEFAULT_QR_CODE_SIZE;
    const qrHeight = dto.height ?? qrWidth;
    const finalizedBuffer = Buffer.from(
      await this.renderVerificationQrCode(
        readFileSync(sourceDocumentPath),
        document.id,
        {
          qrCodePage: dto.page,
          qrCodeX: dto.x,
          qrCodeY: dto.y,
          qrCodeWidth: qrWidth,
          qrCodeHeight: qrHeight,
        },
      ),
    );
    const finalizedOutput = this.saveSignedDocument(
      document.userId,
      document.originalFileName,
      finalizedBuffer,
    );
    const finalizedHash = this.sha256Hex(finalizedBuffer);

    const updatedDocument = await this.prisma.document.update({
      where: { id: document.id },
      data: {
        finalFileName: finalizedOutput.fileName,
        finalFileHash: finalizedHash,
        finalFileSize: finalizedOutput.sizeBytes,
        finalFileIpfsHash: null,
        qrCodePage: dto.page,
        qrCodeX: dto.x,
        qrCodeY: dto.y,
        qrCodeWidth: qrWidth,
        qrCodeHeight: qrHeight,
      },
      select: {
        id: true,
        status: true,
        finalFileName: true,
        finalFileHash: true,
        finalFileIpfsHash: true,
        finalFileSize: true,
        updatedAt: true,
      },
    });

    return {
      message:
        'QR verifikasi berhasil ditempatkan. Dokumen siap ditandatangani.',
      document: updatedDocument,
      file: {
        fileName: finalizedOutput.fileName,
        storagePath: finalizedOutput.absolutePath,
        hash: finalizedHash,
        ipfsHash: null,
        ipfsGatewayUrl: null,
        blockchainTxHash: null,
        sizeBytes: finalizedOutput.sizeBytes,
      },
    };
  }

  async declineDocument(
    userId: string,
    documentId: string,
    dto: DeclineDocumentDto,
  ) {
    await this.ensureIdentityApproved(userId);

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        status: true,
        requiredSigners: {
          where: { userId },
          select: {
            id: true,
            userId: true,
            status: true,
            order: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Dokumen tidak ditemukan');
    }

    if (document.status === 'REVOKED') {
      throw new BadRequestException('Dokumen sudah dihentikan/revoked');
    }

    const signerMembership = document.requiredSigners[0];

    if (!signerMembership) {
      throw new BadRequestException(
        'Anda tidak termasuk signer yang diminta untuk dokumen ini',
      );
    }

    if (signerMembership.status === 'SIGNED') {
      throw new BadRequestException(
        'Dokumen yang sudah ditandatangani tidak dapat ditolak',
      );
    }

    if (signerMembership.status === 'DECLINED') {
      throw new BadRequestException('Anda sudah menolak dokumen ini');
    }

    const nextPendingSigner = await this.prisma.documentSigner.findFirst({
      where: {
        documentId,
        status: 'PENDING',
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: {
        userId: true,
        order: true,
      },
    });

    if (nextPendingSigner && nextPendingSigner.userId !== userId) {
      throw new BadRequestException(
        `Dokumen harus diproses sesuai urutan. Menunggu signer urutan ${nextPendingSigner.order ?? '-'} terlebih dahulu.`,
      );
    }

    const reason = dto.reason.trim();

    const result = await this.prisma.$transaction(async (tx) => {
      const signer = await tx.documentSigner.update({
        where: { id: signerMembership.id },
        data: {
          status: 'DECLINED',
          declinedAt: new Date(),
          declineReason: reason,
        },
        select: {
          userId: true,
          status: true,
          declinedAt: true,
          declineReason: true,
          order: true,
        },
      });

      const updatedDocument = await tx.document.update({
        where: { id: documentId },
        data: { status: 'REVOKED' },
        select: {
          id: true,
          status: true,
          updatedAt: true,
        },
      });

      return {
        signer,
        document: updatedDocument,
      };
    });

    return {
      message: 'Dokumen ditolak dan flow tanda tangan dihentikan',
      ...result,
    };
  }

  private resolveSignPayloadBySigner(
    dto: SignDocumentDto,
    signerMembership: SignerPlaceholderConfig | null,
  ): SignDocumentDto {
    if (!signerMembership || dto.mode !== SignatureMode.VISIBLE) {
      return dto;
    }

    return {
      ...dto,
      visiblePage: signerMembership.visiblePage ?? dto.visiblePage,
      visibleX: signerMembership.visibleX ?? dto.visibleX,
      visibleY: signerMembership.visibleY ?? dto.visibleY,
      visibleWidth: signerMembership.visibleWidth ?? dto.visibleWidth,
      visibleHeight: signerMembership.visibleHeight ?? dto.visibleHeight,
    };
  }

  private emptyPlaceholder(): SignerPlaceholderConfig {
    return {
      visiblePage: null,
      visibleX: null,
      visibleY: null,
      visibleWidth: null,
      visibleHeight: null,
    };
  }

  private buildSignerAcademicProfile(user: {
    role: string;
    studentProfile?: {
      nim: string;
      prodi: { code: string; name: string };
    } | null;
    employeeProfile?: {
      nip: string | null;
      nidn: string | null;
      positionTitle: string | null;
      homeUnit: { code: string; name: string; type: string };
    } | null;
    structuralAssignments?: Array<{
      position: string;
      academicUnit: { code: string; name: string; type: string };
    }>;
  }) {
    if (user.studentProfile) {
      return {
        type: 'STUDENT',
        identifier: user.studentProfile.nim,
        unitCode: user.studentProfile.prodi.code,
        unitName: user.studentProfile.prodi.name,
        unitType: 'PRODI',
        label: `${user.studentProfile.nim} - ${user.studentProfile.prodi.name}`,
        positionTitle: null,
        structuralPositions: [],
      };
    }

    if (user.employeeProfile) {
      const activePosition = user.structuralAssignments?.[0]?.position;
      return {
        type: 'EMPLOYEE',
        identifier: user.employeeProfile.nip ?? user.employeeProfile.nidn,
        unitCode: user.employeeProfile.homeUnit.code,
        unitName: user.employeeProfile.homeUnit.name,
        unitType: user.employeeProfile.homeUnit.type,
        label: [
          user.employeeProfile.positionTitle ?? activePosition ?? user.role,
          user.employeeProfile.homeUnit.name,
        ].join(' - '),
        positionTitle: user.employeeProfile.positionTitle,
        structuralPositions: user.structuralAssignments ?? [],
      };
    }

    return null;
  }

  private async buildAutomaticQrPlacement(
    pdfBuffer: Buffer,
    signaturePlacement: SignerPlaceholderConfig | null,
  ): Promise<
    Pick<
      SignDocumentQueryResult,
      'qrCodePage' | 'qrCodeX' | 'qrCodeY' | 'qrCodeWidth' | 'qrCodeHeight'
    >
  > {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();

    if (pages.length === 0) {
      throw new BadRequestException('Dokumen PDF tidak memiliki halaman');
    }

    const pageNumber = Math.max(
      1,
      Math.min(signaturePlacement?.visiblePage ?? 1, pages.length),
    );
    const page = pages[pageNumber - 1];
    const size = DEFAULT_QR_CODE_SIZE;
    const margin = 24;
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const signatureRect =
      signaturePlacement?.visibleX != null &&
      signaturePlacement.visibleY != null &&
      signaturePlacement.visibleWidth != null &&
      signaturePlacement.visibleHeight != null
        ? {
            x: signaturePlacement.visibleX,
            y: signaturePlacement.visibleY,
            width: signaturePlacement.visibleWidth,
            height: signaturePlacement.visibleHeight,
          }
        : null;

    const candidates = [
      { x: Math.max(0, pageWidth - size - margin), y: margin },
      { x: margin, y: margin },
      {
        x: Math.max(0, pageWidth - size - margin),
        y: Math.max(0, pageHeight - size - margin),
      },
      { x: margin, y: Math.max(0, pageHeight - size - margin) },
    ];
    const selected =
      candidates.find(
        (candidate) =>
          !signatureRect ||
          !this.rectsOverlap(
            { ...candidate, width: size, height: size },
            signatureRect,
          ),
      ) ?? candidates[0];

    return {
      qrCodePage: pageNumber,
      qrCodeX: Number(selected.x.toFixed(2)),
      qrCodeY: Number(selected.y.toFixed(2)),
      qrCodeWidth: size,
      qrCodeHeight: size,
    };
  }

  private rectsOverlap(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  private async renderVerificationQrCode(
    pdfBuffer: Buffer,
    documentId: string,
    placement: Pick<
      SignDocumentQueryResult,
      'qrCodePage' | 'qrCodeX' | 'qrCodeY' | 'qrCodeWidth' | 'qrCodeHeight'
    >,
  ): Promise<Uint8Array> {
    if (
      placement.qrCodePage == null ||
      placement.qrCodeX == null ||
      placement.qrCodeY == null
    ) {
      return pdfBuffer;
    }

    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    const pageIndex = Math.max(
      0,
      Math.min(placement.qrCodePage - 1, pages.length - 1),
    );
    const page = pages[pageIndex];
    const width = placement.qrCodeWidth ?? DEFAULT_QR_CODE_SIZE;
    const height = placement.qrCodeHeight ?? width;
    const verificationBaseUrl =
      process.env.DOCUMENT_VERIFICATION_URL ??
      process.env.FRONTEND_URL ??
      'http://localhost:3000/verify';
    const verificationUrl = `${verificationBaseUrl.replace(
      /\/$/,
      '',
    )}?documentId=${encodeURIComponent(documentId)}`;
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: Math.max(128, Math.ceil(Math.max(width, height) * 2)),
    });
    const qrPng = await pdfDoc.embedPng(
      Buffer.from(qrDataUrl.split(',')[1], 'base64'),
    );

    page.drawImage(qrPng, {
      x: placement.qrCodeX,
      y: placement.qrCodeY,
      width,
      height,
    });

    return pdfDoc.save();
  }

  private async ensureIdentityApproved(userId: string) {
    const identity = await this.prisma.identity.findUnique({
      where: { userId },
      select: { status: true },
    });

    if (!identity || identity.status !== 'APPROVED') {
      throw new BadRequestException('Identitas belum APPROVED');
    }
  }

  private resolveDocumentPath(
    userId: string,
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

    for (const candidate of candidates) {
      const direct = resolve(process.cwd(), candidate);
      if (existsSync(direct)) {
        return direct;
      }

      const signedUserScoped = resolve(signedRoot, userId, candidate);
      if (existsSync(signedUserScoped)) {
        return signedUserScoped;
      }

      const signedRootScoped = resolve(signedRoot, candidate);
      if (existsSync(signedRootScoped)) {
        return signedRootScoped;
      }

      const userScoped = resolve(documentRoot, userId, candidate);
      if (existsSync(userScoped)) {
        return userScoped;
      }

      const rootScoped = resolve(documentRoot, candidate);
      if (existsSync(rootScoped)) {
        return rootScoped;
      }
    }

    // Fallback: locate file by known hash when display name differs from stored file name.
    const userScopedRoot = resolve(documentRoot, userId);
    const signedUserScopedRoot = resolve(signedRoot, userId);
    const fallbackHashes = [names.finalFileHash, names.originalFileHash].filter(
      (value): value is string => Boolean(value),
    );

    for (const hash of fallbackHashes) {
      const fromSignedUserScope = this.findDocumentPathByHash(
        signedUserScopedRoot,
        hash,
      );
      if (fromSignedUserScope) {
        return fromSignedUserScope;
      }

      const fromSignedRootScope = this.findDocumentPathByHash(signedRoot, hash);
      if (fromSignedRootScope) {
        return fromSignedRootScope;
      }

      const fromUserScope = this.findDocumentPathByHash(userScopedRoot, hash);
      if (fromUserScope) {
        return fromUserScope;
      }

      const fromRootScope = this.findDocumentPathByHash(documentRoot, hash);
      if (fromRootScope) {
        return fromRootScope;
      }
    }

    throw new NotFoundException(
      'File dokumen sumber tidak ditemukan untuk proses signing',
    );
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
        const nestedResult = this.findDocumentPathByHash(
          absolutePath,
          expectedHash,
        );
        if (nestedResult) {
          return nestedResult;
        }
        continue;
      }

      const content = readFileSync(absolutePath);
      const currentHash = this.sha256Hex(content);
      if (currentHash === expectedHash) {
        return absolutePath;
      }
    }

    return null;
  }

  private resolveSignatureImagePath(userId: string): string | null {
    const signatureRoot = resolve(
      process.cwd(),
      process.env.SIGNATURE_UPLOAD_DIR ?? 'uploads/signatures',
    );
    const userDir = resolve(signatureRoot, userId);

    if (!existsSync(userDir)) {
      return null;
    }

    const fileName = readdirSync(userDir).find((file) =>
      file.startsWith(`${userId}-signature`),
    );

    if (!fileName) {
      return null;
    }

    const absolutePath = resolve(userDir, fileName);
    return existsSync(absolutePath) ? absolutePath : null;
  }

  private async renderVisibleSignatureAppearance(
    sourcePdf: Buffer,
    dto: SignDocumentDto,
    signatureImagePath: string | null,
    userId: string,
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(sourcePdf);
    const pages = pdfDoc.getPages();

    if (pages.length === 0) {
      throw new BadRequestException('Dokumen PDF tidak memiliki halaman');
    }

    const pageIndex = Math.max(0, (dto.visiblePage ?? 1) - 1);
    const targetPage = pages[Math.min(pageIndex, pages.length - 1)];

    const width = dto.visibleWidth ?? 160;
    const height = dto.visibleHeight ?? 70;
    const x = dto.visibleX ?? Math.max(0, targetPage.getWidth() - width - 36);
    const y = dto.visibleY ?? 36;

    if (signatureImagePath) {
      const signatureImage = readFileSync(signatureImagePath);
      const extension = extname(signatureImagePath).toLowerCase();
      const embeddedImage =
        extension === '.png'
          ? await pdfDoc.embedPng(signatureImage)
          : await pdfDoc.embedJpg(signatureImage);

      targetPage.drawImage(embeddedImage, {
        x,
        y,
        width,
        height,
      });
    } else {
      targetPage.drawText('Digitally Signed', {
        x,
        y: y + 18,
        size: 12,
      });
      targetPage.drawText(`User: ${userId}`, {
        x,
        y: y + 2,
        size: 9,
      });
    }

    const bytes = await pdfDoc.save({ useObjectStreams: false });
    return Buffer.from(bytes);
  }

  private async preRenderAllVisibleAppearances(
    sourcePdf: Buffer,
    documentId: string,
    requestedSigners: Array<{
      userId: string;
      preferredSignatureMode: 'VISIBLE' | 'INVISIBLE';
    }>,
  ): Promise<Buffer> {
    // Fetch all placeholder configs for visible signers
    const visibleSigners = await this.prisma.documentSigner.findMany({
      where: {
        documentId,
        userId: {
          in: requestedSigners
            .filter((s) => s.preferredSignatureMode === 'VISIBLE')
            .map((s) => s.userId),
        },
      },
      select: {
        userId: true,
        visiblePage: true,
        visibleX: true,
        visibleY: true,
        visibleWidth: true,
        visibleHeight: true,
      },
    });

    if (visibleSigners.length === 0) {
      return sourcePdf;
    }

    const pdfDoc = await PDFDocument.load(sourcePdf);
    const pages = pdfDoc.getPages();

    if (pages.length === 0) {
      throw new BadRequestException('Dokumen PDF tidak memiliki halaman');
    }

    // Render all visible signatures to the PDF
    for (const signer of visibleSigners) {
      const pageIndex = Math.max(0, (signer.visiblePage ?? 1) - 1);
      const targetPage = pages[Math.min(pageIndex, pages.length - 1)];
      const width = signer.visibleWidth ?? 160;
      const height = signer.visibleHeight ?? 70;
      const x = signer.visibleX ?? 36;
      const y = signer.visibleY ?? 36;

      const signatureImagePath = this.resolveSignatureImagePath(signer.userId);
      if (!signatureImagePath) {
        throw new BadRequestException(
          `Signature image signer ${signer.userId} belum tersedia untuk pre-render visible signature`,
        );
      }

      try {
        const signatureImage = readFileSync(signatureImagePath);
        const extension = extname(signatureImagePath).toLowerCase();
        const embeddedImage =
          extension === '.png'
            ? await pdfDoc.embedPng(signatureImage)
            : await pdfDoc.embedJpg(signatureImage);

        targetPage.drawImage(embeddedImage, {
          x,
          y,
          width,
          height,
        });
      } catch {
        throw new BadRequestException(
          `Gagal membaca signature image untuk signer ${signer.userId}`,
        );
      }
    }

    const bytes = await pdfDoc.save({ useObjectStreams: false });
    return Buffer.from(bytes);
  }

  private async preparePdfForSigning(
    sourcePdf: Buffer,
    dto: SignDocumentDto,
    signatureImagePath: string | null,
    userId: string,
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(sourcePdf);
    const pages = pdfDoc.getPages();

    if (pages.length === 0) {
      throw new BadRequestException('Dokumen PDF tidak memiliki halaman');
    }

    if (dto.mode === SignatureMode.VISIBLE) {
      const pageIndex = Math.max(0, (dto.visiblePage ?? 1) - 1);
      const targetPage = pages[Math.min(pageIndex, pages.length - 1)];

      const width = dto.visibleWidth ?? 160;
      const height = dto.visibleHeight ?? 70;
      const x = dto.visibleX ?? Math.max(0, targetPage.getWidth() - width - 36);
      const y = dto.visibleY ?? 36;

      if (signatureImagePath) {
        const signatureImage = readFileSync(signatureImagePath);
        const extension = extname(signatureImagePath).toLowerCase();
        const embeddedImage =
          extension === '.png'
            ? await pdfDoc.embedPng(signatureImage)
            : await pdfDoc.embedJpg(signatureImage);

        targetPage.drawImage(embeddedImage, {
          x,
          y,
          width,
          height,
        });
      } else {
        targetPage.drawText('Digitally Signed', {
          x,
          y: y + 18,
          size: 12,
        });
        targetPage.drawText(`User: ${userId}`, {
          x,
          y: y + 2,
          size: 9,
        });
      }

      pdflibAddPlaceholder({
        pdfDoc,
        pdfPage: targetPage,
        reason: dto.reason ?? 'DOCChain digital signature',
        name: `User ${userId}`,
        contactInfo: 'support@docchain.local',
        location: 'DOCChain',
        signingTime: new Date(),
        widgetRect: [x, y, x + width, y + height],
      });
    } else {
      pdflibAddPlaceholder({
        pdfDoc,
        reason: dto.reason ?? 'DOCChain digital signature',
        name: `User ${userId}`,
        contactInfo: 'support@docchain.local',
        location: 'DOCChain',
        signingTime: new Date(),
      });
    }

    const bytes = await pdfDoc.save({ useObjectStreams: false });
    return Buffer.from(bytes);
  }

  private preparePdfForIncrementalSigning(
    sourcePdf: Buffer,
    dto: SignDocumentDto,
    userId: string,
  ): Buffer {
    // For multi-signer flow, use plain placeholder to avoid full PDF rewrite
    // and preserve previous digital signatures as incremental revisions.
    const width = dto.visibleWidth ?? 160;
    const height = dto.visibleHeight ?? 70;
    const x = dto.visibleX ?? 36;
    const y = dto.visibleY ?? 36;

    return plainAddPlaceholder({
      pdfBuffer: sourcePdf,
      reason: dto.reason ?? 'DOCChain digital signature',
      name: `User ${userId}`,
      contactInfo: 'support@docchain.local',
      location: 'DOCChain',
      signingTime: new Date(),
      ...(dto.mode === SignatureMode.VISIBLE
        ? { widgetRect: [x, y, x + width, y + height] }
        : {}),
    });
  }

  private saveSignedDocument(
    userId: string,
    originalFileName: string | null,
    content: Buffer,
  ) {
    const signedRoot = resolve(
      process.cwd(),
      process.env.SIGNED_DOCUMENT_DIR ?? 'uploads/signed-documents',
    );
    const userDir = resolve(signedRoot, userId);
    mkdirSync(userDir, { recursive: true });

    const fileName = this.buildSignedPdfFileName(originalFileName);
    const absolutePath = resolve(userDir, fileName);
    writeFileSync(absolutePath, content);

    return {
      fileName,
      absolutePath,
      sizeBytes: content.length,
    };
  }

  private sha256Hex(content: Buffer) {
    return createHash('sha256').update(content).digest('hex');
  }

  private async getOrCreateCertificate(userId: string): Promise<{
    certificateId: string;
    p12Data: Buffer;
    passphrase: string;
  }> {
    const signerProfile = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        displayName: true,
        email: true,
        identity: {
          select: {
            fullName: true,
          },
        },
      },
    });

    const commonName = (
      signerProfile?.identity?.fullName?.trim() ||
      signerProfile?.displayName?.trim() ||
      signerProfile?.email?.trim() ||
      userId
    ).replace(/,/g, ' ');
    const organizationName = 'DOCChain';
    const subjectDn = `CN=${commonName},O=${organizationName},C=ID`;
    const caIdentity = this.loadCertificateAuthority();
    const issuerDn = this.formatForgeDn(
      caIdentity.certificate.subject.attributes,
    );

    const existing = await this.prisma.certificate.findFirst({
      where: {
        userId,
        isActive: true,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        p12Data: true,
        p12PasswordEnc: true,
        notAfter: true,
        subjectDN: true,
        issuerDN: true,
      },
    });

    const requiresRotation =
      !!existing && this.shouldRotateCertificate(existing, subjectDn, issuerDn);

    if (existing && existing.notAfter > new Date() && !requiresRotation) {
      return {
        certificateId: existing.id,
        p12Data: Buffer.from(existing.p12Data),
        passphrase: this.unsealSecret(existing.p12PasswordEnc),
      };
    }

    if (existing) {
      await this.prisma.certificate.update({
        where: { id: existing.id },
        data: {
          status: requiresRotation ? 'REVOKED' : 'EXPIRED',
          isActive: false,
          ...(requiresRotation ? { revokedAt: new Date() } : {}),
        },
      });
    }

    const pki = forge.pki;
    const keys = pki.rsa.generateKeyPair(2048);
    const cert = pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = randomBytes(8).toString('hex');
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const attrs = [
      { name: 'commonName', value: commonName },
      { name: 'organizationName', value: organizationName },
      { name: 'countryName', value: 'ID' },
    ];

    cert.setSubject(attrs);
    cert.setIssuer(caIdentity.certificate.subject.attributes);
    cert.setExtensions([
      {
        name: 'basicConstraints',
        cA: false,
      },
      {
        name: 'keyUsage',
        digitalSignature: true,
        nonRepudiation: true,
      },
      {
        name: 'extKeyUsage',
        clientAuth: true,
        emailProtection: true,
      },
      {
        name: 'subjectKeyIdentifier',
      },
      {
        name: 'authorityKeyIdentifier',
        keyIdentifier: true,
        authorityCertIssuer: true,
        serialNumber: caIdentity.certificate.serialNumber,
      },
    ]);
    cert.sign(caIdentity.privateKey, forge.md.sha256.create());

    const passphrase = randomBytes(16).toString('hex');
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
      keys.privateKey,
      cert,
      passphrase,
      {
        algorithm: '3des',
        count: 2048,
        saltSize: 8,
        useMac: true,
        friendlyName: `${organizationName} ${commonName}`,
      },
    );

    const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
    const p12Buffer = Buffer.from(p12Der, 'binary');
    const certificateSerialNumber: string = String(cert.serialNumber);
    const certificateNotBefore: Date = new Date(cert.validity.notBefore);
    const certificateNotAfter: Date = new Date(cert.validity.notAfter);

    const created = await this.prisma.certificate.create({
      data: {
        userId,
        p12Data: p12Buffer,
        p12PasswordEnc: this.sealSecret(passphrase),
        subjectDN: subjectDn,
        issuerDN: issuerDn,
        serialNumber: certificateSerialNumber,
        notBefore: certificateNotBefore,
        notAfter: certificateNotAfter,
        status: 'ACTIVE',
        isActive: true,
      },
      select: { id: true },
    });

    return {
      certificateId: created.id,
      p12Data: p12Buffer,
      passphrase,
    };
  }

  private shouldRotateCertificate(
    existingCertificate: {
      subjectDN: string;
      issuerDN: string | null;
    },
    expectedSubjectDn: string,
    expectedIssuerDn: string,
  ) {
    const normalizeDn = (dn: string | null) =>
      (dn ?? '').toLowerCase().replace(/\s+/g, '').replace(/,+/g, ',').trim();

    const currentSubject = normalizeDn(existingCertificate.subjectDN);
    const currentIssuer = normalizeDn(existingCertificate.issuerDN);
    const expectedSubject = normalizeDn(expectedSubjectDn);
    const expectedIssuer = normalizeDn(expectedIssuerDn);

    return (
      currentSubject !== expectedSubject ||
      (currentIssuer !== '' && currentIssuer !== expectedIssuer)
    );
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

  private loadCertificateAuthority(): {
    certificate: forge.pki.Certificate;
    privateKey: forge.pki.rsa.PrivateKey;
  } {
    const defaultDocchainCertPath = 'certs/docchain-ca.crt';
    const defaultDocchainKeyPath = 'certs/docchain-ca.key';
    const caCertPath = resolve(
      process.cwd(),
      process.env.DOCCHAIN_CA_CERT_PATH ??
        process.env.DOCHAIN_CA_CERT_PATH ??
        (existsSync(resolve(process.cwd(), defaultDocchainCertPath))
          ? defaultDocchainCertPath
          : 'certs/dochain-ca.crt'),
    );
    const caKeyPath = resolve(
      process.cwd(),
      process.env.DOCCHAIN_CA_KEY_PATH ??
        process.env.DOCHAIN_CA_KEY_PATH ??
        (existsSync(resolve(process.cwd(), defaultDocchainKeyPath))
          ? defaultDocchainKeyPath
          : 'certs/dochain-ca.key'),
    );

    if (!existsSync(caCertPath) || !existsSync(caKeyPath)) {
      throw new BadRequestException(
        'DOCChain CA belum tersedia. Generate certs/docchain-ca.crt dan certs/docchain-ca.key terlebih dahulu.',
      );
    }

    const certificatePem = readFileSync(caCertPath, 'utf8');
    const privateKeyPem = readFileSync(caKeyPath, 'utf8');
    const certificate = forge.pki.certificateFromPem(certificatePem);
    const passphrase =
      process.env.DOCCHAIN_CA_KEY_PASSPHRASE ??
      process.env.DOCHAIN_CA_KEY_PASSPHRASE;
    const privateKey = passphrase
      ? forge.pki.decryptRsaPrivateKey(privateKeyPem, passphrase)
      : forge.pki.privateKeyFromPem(privateKeyPem);

    if (!privateKey) {
      throw new BadRequestException('Private key DOCChain CA tidak valid');
    }

    return {
      certificate,
      privateKey,
    };
  }

  private formatForgeDn(attributes: forge.pki.CertificateField[]) {
    const keyByName: Record<string, string> = {
      commonName: 'CN',
      organizationName: 'O',
      organizationalUnitName: 'OU',
      countryName: 'C',
      stateOrProvinceName: 'ST',
      localityName: 'L',
      emailAddress: 'E',
    };

    return attributes
      .map((attribute) => {
        const key =
          keyByName[attribute.name ?? ''] ??
          attribute.shortName ??
          attribute.name;
        return `${key}=${String(attribute.value).replace(/,/g, ' ')}`;
      })
      .join(',');
  }

  private sealSecret(plainText: string): string {
    const secret = process.env.CERT_SECRET_KEY ?? 'dochain-dev-secret';
    const key = createHash('sha256').update(secret).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  private unsealSecret(sealedText: string): string {
    const secret = process.env.CERT_SECRET_KEY ?? 'dochain-dev-secret';
    const key = createHash('sha256').update(secret).digest();

    const [version, ivB64, tagB64, encryptedB64] = sealedText.split(':');
    if (version !== 'v1' || !ivB64 || !tagB64 || !encryptedB64) {
      throw new BadRequestException('Format p12PasswordEnc tidak valid');
    }

    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const encrypted = Buffer.from(encryptedB64, 'base64');

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const plainText = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return plainText.toString('utf8');
  }
}
