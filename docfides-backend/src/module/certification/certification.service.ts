import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
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
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { plainAddPlaceholder } from '@signpdf/placeholder-plain';
import signpdf from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import { PrismaService } from '../prisma/prisma.service';
import { SignDocumentDto, SignatureMode } from './dto/sign-document.dto';
import { RequestSignersDto } from './dto/request-signers.dto';

@Injectable()
export class CertificationService {
  constructor(private prisma: PrismaService) { }

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
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        status: true,
        originalFileName: true,
        finalFileName: true,
        updatedAt: true,
        _count: {
          select: {
            requiredSigners: true,
            signatures: true,
          },
        },
      },
    });

    return {
      documents: documents.map((item) => ({
        id: item.id,
        status: item.status,
        originalFileName: item.originalFileName,
        finalFileName: item.finalFileName,
        requiredSignerCount: item._count.requiredSigners,
        updatedAt: item.updatedAt,
      })),
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

  async getDocumentFileForPreview(userId: string, documentId: string) {
    return this.getDocumentFileByVariant(userId, documentId, 'latest');
  }

  async getOriginalDocumentFile(userId: string, documentId: string) {
    return this.getDocumentFileByVariant(userId, documentId, 'original');
  }

  async getSignedDocumentFile(userId: string, documentId: string) {
    return this.getDocumentFileByVariant(userId, documentId, 'signed');
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
      !document.finalFileName &&
      !document.finalFileHash
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
          ? (document.finalFileName ?? `${document.id}-signed.pdf`)
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
      },
    });

    return {
      signers: users,
    };
  }

  getSignatureStatus(userId: string) {
    const signaturePath = this.resolveSignatureImagePath(userId);
    if (!signaturePath) {
      return {
        hasSignature: false,
        signature: null,
      };
    }

    return {
      hasSignature: true,
      signature: {
        fileName: signaturePath.split(/[\\/]/).pop() ?? null,
        storagePath: signaturePath,
      },
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

    const signerIds = Array.from(
      new Set(dto.signerUserIds.map((id) => id.trim()).filter(Boolean)),
    );

    if (signerIds.length === 0) {
      throw new BadRequestException('Daftar signer tidak boleh kosong');
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
      },
    });

    if (users.length !== signerIds.length) {
      const foundIds = new Set(users.map((user) => user.id));
      const missing = signerIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `User signer tidak ditemukan: ${missing.join(', ')}`,
      );
    }

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

    const maxOrder = await this.prisma.documentSigner.aggregate({
      where: { documentId },
      _max: { order: true },
    });

    let nextOrder = (maxOrder._max.order ?? 0) + 1;

    const result = await this.prisma.$transaction(async (tx) => {
      const processed = [] as Array<{
        userId: string;
        status: string;
        order: number | null;
        action: 'invited' | 're-requested' | 'already-exists';
      }>;

      for (const signerUserId of signerIds) {
        const existingSigner = existingByUserId.get(signerUserId);

        if (!existingSigner) {
          const created = await tx.documentSigner.create({
            data: {
              documentId,
              userId: signerUserId,
              status: 'PENDING',
              order: nextOrder,
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
          });

          nextOrder += 1;
          continue;
        }

        if (existingSigner.status === 'DECLINED') {
          const updated = await tx.documentSigner.update({
            where: { id: existingSigner.id },
            data: {
              status: 'PENDING',
              signedAt: null,
              signatureId: null,
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
          });

          continue;
        }

        processed.push({
          userId: existingSigner.userId,
          status: existingSigner.status,
          order: existingSigner.order,
          action: 'already-exists',
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
        : {
          id: document.id,
          status: document.status,
          updatedAt: new Date(),
        };

      return {
        processed,
        document: updatedDocument,
      };
    });

    return {
      message: 'Permintaan tanda tangan berhasil dikirim',
      document: result.document,
      signers: result.processed.map((item) => {
        const user = users.find((candidate) => candidate.id === item.userId);
        return {
          userId: item.userId,
          email: user?.email ?? null,
          displayName: user?.displayName ?? null,
          status: item.status,
          order: item.order,
          action: item.action,
        };
      }),
    };
  }

  uploadSignatureImage(userId: string, signatureFile: Express.Multer.File) {
    if (!signatureFile) {
      throw new BadRequestException('File tanda tangan wajib diunggah');
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
    const document = await this.prisma.document.findUnique({
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
    });

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

    const requiredSignersCount = document._count.requiredSigners;
    const signerMembership = document.requiredSigners[0] ?? null;
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

    const sourcePdfBuffer = readFileSync(sourceDocumentPath);
    const { p12Data, passphrase, certificateId } =
      await this.getOrCreateCertificate(userId);

    const preparedPdf = this.preparePdfForIncrementalSigning(
      sourcePdfBuffer,
      dto,
      userId,
    );

    const signer = new P12Signer(p12Data, { passphrase });
    const signedPdfBuffer = await signpdf.sign(preparedPdf, signer, new Date());

    const signedOutput = this.saveSignedDocument(
      documentStorageOwnerId,
      document.id,
      signedPdfBuffer,
    );
    const signedHash = this.sha256Hex(signedPdfBuffer);

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
          documentHash: signedHash,
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

      const totalRequiredSigners = await tx.documentSigner.count({
        where: { documentId },
      });
      const pendingSigners = await tx.documentSigner.count({
        where: {
          documentId,
          status: { not: 'SIGNED' },
        },
      });

      const nextStatus =
        totalRequiredSigners === 0 || pendingSigners === 0
          ? 'FULLY_SIGNED'
          : 'PARTIALLY_SIGNED';

      const updatedDocument = await tx.document.update({
        where: { id: documentId },
        data: {
          status: nextStatus,
          finalFileName: signedOutput.fileName,
          finalFileHash: signedHash,
          finalFileSize: signedOutput.sizeBytes,
        },
        select: {
          id: true,
          status: true,
          finalFileName: true,
          finalFileHash: true,
          finalFileSize: true,
          updatedAt: true,
        },
      });

      return {
        signature: createdSignature,
        document: updatedDocument,
      };
    });

    return {
      message: 'Dokumen berhasil ditandatangani secara digital',
      mode: dto.mode,
      signedFile: {
        fileName: signedOutput.fileName,
        storagePath: signedOutput.absolutePath,
        hash: signedHash,
        sizeBytes: signedOutput.sizeBytes,
      },
      ...transactionResult,
    };
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
        reason: dto.reason ?? 'DocFides digital signature',
        name: `User ${userId}`,
        contactInfo: 'support@docfides.local',
        location: 'DocFides',
        signingTime: new Date(),
        widgetRect: [x, y, x + width, y + height],
      });
    } else {
      pdflibAddPlaceholder({
        pdfDoc,
        reason: dto.reason ?? 'DocFides digital signature',
        name: `User ${userId}`,
        contactInfo: 'support@docfides.local',
        location: 'DocFides',
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
      reason: dto.reason ?? 'DocFides digital signature',
      name: `User ${userId}`,
      contactInfo: 'support@docfides.local',
      location: 'DocFides',
      signingTime: new Date(),
      ...(dto.mode === SignatureMode.VISIBLE
        ? { widgetRect: [x, y, x + width, y + height] }
        : {}),
    });
  }

  private saveSignedDocument(
    userId: string,
    documentId: string,
    content: Buffer,
  ) {
    const signedRoot = resolve(
      process.cwd(),
      process.env.SIGNED_DOCUMENT_DIR ?? 'uploads/signed-documents',
    );
    const userDir = resolve(signedRoot, userId);
    mkdirSync(userDir, { recursive: true });

    const fileName = `${documentId}-${Date.now()}-signed.pdf`;
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
    const organizationName = 'DoChain';
    const subjectDn = `CN=${commonName},O=${organizationName},C=ID`;

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
      !!existing && this.shouldRotateCertificate(existing, subjectDn);

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
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    const passphrase = randomBytes(16).toString('hex');
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
      keys.privateKey,
      [cert],
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
        issuerDN: subjectDn,
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
  ) {
    const normalizeDn = (dn: string | null) =>
      (dn ?? '').toLowerCase().replace(/\s+/g, '').replace(/,+/g, ',').trim();

    const currentSubject = normalizeDn(existingCertificate.subjectDN);
    const currentIssuer = normalizeDn(existingCertificate.issuerDN);
    const expected = normalizeDn(expectedSubjectDn);

    return (
      currentSubject !== expected ||
      (currentIssuer !== '' && currentIssuer !== expected)
    );
  }

  private sealSecret(plainText: string): string {
    const secret = process.env.CERT_SECRET_KEY ?? 'docfides-dev-secret';
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
    const secret = process.env.CERT_SECRET_KEY ?? 'docfides-dev-secret';
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
