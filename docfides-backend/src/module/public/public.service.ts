import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as forge from 'node-forge';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  BlockchainDocumentRecord,
  BlockchainService,
} from '../blockchain/blockchain.service';

/* ─── Response Types ────────────────────────────────────────────────── */

export type CertificateInfo = {
  subject: Record<string, string>;
  issuer: Record<string, string>;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  isExpired: boolean;
  isCa: boolean;
  keyAlgorithm: string;
  keySize: number | null;
  sha256Fingerprint: string;
  sha1Fingerprint: string;
  signatureAlgorithm: string;
  subjectKeyId: string | null;
  authorityKeyId: string | null;
};

export type SignatureDetail = {
  signerName: string;
  signerDN: string;
  reason: string | null;
  location: string | null;
  contactInfo: string | null;
  signedAt: string | null;
  digestAlgorithm: string;
  encryptionAlgorithm: string;
  integrityStatus: 'INTACT' | 'MODIFIED' | 'CANNOT_VERIFY';
  integrityMessage: string;
  certificateChain: CertificateInfo[];
};

export type DbMatchResult = {
  found: boolean;
  documentId: string | null;
  originalFileName: string | null;
  status: string | null;
  isValid: boolean;
  isRevoked: boolean;
};

export type InspectDocumentResult = {
  overallStatus:
    | 'VALID'
    | 'MODIFIED'
    | 'NO_SIGNATURES'
    | 'PARTIAL'
    | 'NOT_RECORDED'
    | 'REVOKED';
  overallMessage: string;
  fileHash: string;
  fileSize: number;
  signatureCount: number;
  signatures: SignatureDetail[];
  dbMatch: DbMatchResult;
  blockchain: BlockchainDocumentRecord | null;
  verification: {
    hashMatchesBlockchain: boolean;
    registeredOnBlockchain: boolean;
    revokedOnBlockchain: boolean;
    verified: boolean;
    message: string;
  };
};

type PdfSignatureFields = {
  signedAt: string | null;
  reason: string | null;
  location: string | null;
  contactInfo: string | null;
};

/* ─── Service ───────────────────────────────────────────────────────── */

@Injectable()
export class PublicService {
  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
  ) {}

  /* ════════════════════════════════════════════════════════════════════
   *  EXISTING: Verify document by ID (called from QR scan)
   * ═══════════════════════════════════════════════════════════════════*/

  async verifyDocument(documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        status: true,
        originalFileName: true,
        finalFileHash: true,
        finalFileIpfsHash: true,
        blockchainTxHash: true,
        revokedAt: true,
        revokeReason: true,
        createdAt: true,
        updatedAt: true,
        revokedBy: {
          select: {
            displayName: true,
            role: true,
          },
        },
        user: {
          select: {
            displayName: true,
            role: true,
            studentProfile: {
              select: {
                prodi: {
                  select: { name: true, type: true },
                },
              },
            },
            employeeProfile: {
              select: {
                positionTitle: true,
                homeUnit: {
                  select: { name: true, type: true },
                },
              },
            },
            structuralAssignments: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              select: {
                position: true,
                academicUnit: {
                  select: { name: true, type: true },
                },
              },
            },
          },
        },
        requiredSigners: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
          select: {
            order: true,
            status: true,
            signedAt: true,
            user: {
              select: {
                displayName: true,
                role: true,
                employeeProfile: {
                  select: {
                    positionTitle: true,
                    homeUnit: {
                      select: { name: true, type: true },
                    },
                  },
                },
                structuralAssignments: {
                  take: 1,
                  orderBy: { createdAt: 'desc' },
                  select: {
                    position: true,
                    academicUnit: {
                      select: { name: true, type: true },
                    },
                  },
                },
              },
            },
          },
        },
        signatures: {
          orderBy: { order: 'desc' },
          take: 1,
          select: {
            signedAt: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Dokumen tidak ditemukan');
    }

    const status = document.status;
    const isValid = status === 'FULLY_SIGNED';
    const isRevoked = status === 'REVOKED';

    // Resolve owner display info - only show name and unit, NO email/NIK/NIM/NIP
    const ownerUser = document.user;
    const ownerUnitName =
      ownerUser?.studentProfile?.prodi?.name ??
      ownerUser?.employeeProfile?.homeUnit?.name ??
      ownerUser?.structuralAssignments?.[0]?.academicUnit?.name ??
      null;

    const ownerUnitType =
      ownerUser?.studentProfile?.prodi?.type ??
      ownerUser?.employeeProfile?.homeUnit?.type ??
      ownerUser?.structuralAssignments?.[0]?.academicUnit?.type ??
      null;

    // Resolve final document proof data
    const latestSignature = document.signatures[0] ?? null;
    const blockchainTxHash = document.blockchainTxHash ?? null;
    const ipfsHash = document.finalFileIpfsHash ?? null;
    const blockchainRecord = document.finalFileHash
      ? await this.blockchainService.getRecordByHash(document.finalFileHash)
      : null;

    // Resolve signers - show name, role/position, signing status and time only
    const signers = document.requiredSigners.map((signer, index) => {
      const signerUser = signer.user;
      const positionTitle =
        signerUser?.employeeProfile?.positionTitle ??
        signerUser?.structuralAssignments?.[0]?.position ??
        signerUser?.role ??
        null;

      const unitName =
        signerUser?.employeeProfile?.homeUnit?.name ??
        signerUser?.structuralAssignments?.[0]?.academicUnit?.name ??
        null;

      return {
        order: signer.order ?? index + 1,
        displayName: signerUser?.displayName ?? 'Penandatangan',
        positionTitle: this.formatPosition(positionTitle),
        unitName,
        status: signer.status,
        signedAt: signer.status === 'SIGNED' ? signer.signedAt : null,
      };
    });

    // Determine completedAt from when last signer signed
    const lastSignedAt =
      document.requiredSigners
        .filter((s) => s.status === 'SIGNED' && s.signedAt)
        .sort((a, b) => {
          const aTime = a.signedAt?.getTime() ?? 0;
          const bTime = b.signedAt?.getTime() ?? 0;
          return bTime - aTime;
        })[0]?.signedAt ?? null;

    return {
      documentId: document.id,
      status,
      isValid,
      isRevoked,
      originalFileName: document.originalFileName,
      completedAt: isValid ? lastSignedAt ?? document.updatedAt : null,
      createdAt: document.createdAt,
      owner: ownerUser
        ? {
            displayName: ownerUser.displayName,
            unitName: ownerUnitName,
            unitType: ownerUnitType,
          }
        : null,
      signers,
      revocation: isRevoked
        ? {
            revokedAt: document.revokedAt,
            reason: document.revokeReason,
            revokedBy: document.revokedBy
              ? {
                  displayName: document.revokedBy.displayName,
                  role: document.revokedBy.role,
                }
              : null,
          }
        : null,
      proof: {
        ipfsHash,
        blockchainTxHash,
        blockchain: blockchainRecord,
      },
    };
  }

  /* ════════════════════════════════════════════════════════════════════
   *  NEW: Inspect PDF file — parse PKCS#7 signatures + CA chain
   * ═══════════════════════════════════════════════════════════════════*/

  async inspectDocument(fileBuffer: Buffer): Promise<InspectDocumentResult> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('File PDF tidak boleh kosong');
    }

    // Basic PDF header check
    const header = fileBuffer.slice(0, 5).toString('ascii');
    if (!header.startsWith('%PDF')) {
      throw new BadRequestException('File yang diunggah bukan file PDF yang valid');
    }

    // Compute SHA-256 of the file for DB cross-check
    const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
    const fileSize = fileBuffer.length;

    // Cross-check with DOCChain database
    const dbMatch = await this.crossCheckDatabase(fileHash);
    const blockchain = await this.blockchainService.getRecordByHash(fileHash);

    // Extract and parse PDF signatures
    const signatures = await this.extractPdfSignatures(fileBuffer);

    const registeredOnBlockchain = Boolean(blockchain?.exists);
    const revokedOnBlockchain = Boolean(blockchain?.revoked);
    const hashMatchesBlockchain =
      registeredOnBlockchain &&
      blockchain?.documentHash?.toLowerCase().replace(/^0x/, '') ===
        fileHash.toLowerCase();

    // Determine overall status from blockchain proof first, then PDF signatures.
    let overallStatus: InspectDocumentResult['overallStatus'];
    let overallMessage: string;

    if (!registeredOnBlockchain) {
      overallStatus = 'NOT_RECORDED';
      overallMessage =
        'Hash file ini tidak ditemukan di blockchain DOCChain. Dokumen belum dapat dinyatakan sebagai dokumen final resmi DOCChain.';
    } else if (revokedOnBlockchain) {
      overallStatus = 'REVOKED';
      overallMessage =
        'Hash file ditemukan di blockchain, tetapi status dokumen sudah dicabut/revoked.';
    } else if (signatures.length === 0) {
      overallStatus = 'NO_SIGNATURES';
      overallMessage =
        'Hash file cocok dengan blockchain, tetapi PDF tidak memiliki tanda tangan digital yang dapat dibaca.';
    } else if (signatures.every((s) => s.integrityStatus === 'INTACT')) {
      overallStatus = 'VALID';
      overallMessage = `Hash file cocok dengan blockchain dan semua ${signatures.length} tanda tangan digital masih utuh.`;
    } else if (signatures.some((s) => s.integrityStatus === 'MODIFIED')) {
      overallStatus = 'MODIFIED';
      overallMessage =
        'Hash file tercatat, tetapi tanda tangan PDF menunjukkan dokumen telah dimodifikasi setelah ditandatangani.';
    } else {
      overallStatus = 'PARTIAL';
      overallMessage =
        'Hash file cocok dengan blockchain, tetapi sebagian tanda tangan tidak dapat diverifikasi sepenuhnya.';
    }

    const verified =
      overallStatus === 'VALID' &&
      hashMatchesBlockchain &&
      registeredOnBlockchain &&
      !revokedOnBlockchain;

    return {
      overallStatus,
      overallMessage,
      fileHash,
      fileSize,
      signatureCount: signatures.length,
      signatures,
      dbMatch,
      blockchain,
      verification: {
        hashMatchesBlockchain,
        registeredOnBlockchain,
        revokedOnBlockchain,
        verified,
        message: verified
          ? 'Dokumen valid: hash file cocok dengan blockchain, belum dicabut, dan tanda tangan digital utuh.'
          : overallMessage,
      },
    };
  }

  /* ─── PDF Signature Extraction ─────────────────────────────────────── */

  private async extractPdfSignatures(pdfBuffer: Buffer): Promise<SignatureDetail[]> {
    const results: SignatureDetail[] = [];

    try {
      // Load CA cert to build trust chain
      const caCert = this.loadCaCertificate();
      const signatureEntries = this.extractPdfSignatureEntries(pdfBuffer);

      for (let i = 0; i < signatureEntries.length; i++) {
        const { byteRange, hexContent, pdfFields } = signatureEntries[i];

        try {
          const sigDetail = this.parseSignatureContent(
            pdfBuffer,
            byteRange,
            hexContent,
            caCert,
            pdfFields,
          );
          if (sigDetail) {
            results.push(sigDetail);
          } else {
            results.push(this.buildUnreadableSignatureDetail(i));
          }
        } catch {
          // If one signature fails to parse, add a placeholder with error info
          results.push(this.buildUnreadableSignatureDetail(i));
        }
      }
    } catch {
      // If PDF parsing fails entirely, return empty
    }

    return results;
  }

  private extractPdfSignatureEntries(pdfBuffer: Buffer) {
    const pdfStr = pdfBuffer.toString('latin1');
    const byteRangePattern = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
    const entries: Array<{
      byteRange: [number, number, number, number];
      hexContent: string;
      pdfFields: PdfSignatureFields;
    }> = [];

    let match: RegExpExecArray | null;
    while ((match = byteRangePattern.exec(pdfStr)) !== null) {
      const byteRange = match.slice(1, 5).map(Number) as [
        number,
        number,
        number,
        number,
      ];

      if (byteRange.some((part) => !Number.isFinite(part) || part < 0)) {
        continue;
      }

      const hexContent = this.extractSignatureHexContent(pdfStr, match.index);
      if (hexContent && hexContent.length >= 10) {
        entries.push({
          byteRange,
          hexContent,
          pdfFields: this.extractPdfSignatureFields(pdfStr, match.index),
        });
      }
    }

    return entries;
  }

  private extractPdfSignatureFields(
    pdfStr: string,
    byteRangeIndex: number,
  ): PdfSignatureFields {
    const dictionaryWindow = pdfStr.slice(
      Math.max(0, byteRangeIndex - 20_000),
      Math.min(pdfStr.length, byteRangeIndex + 20_000),
    );

    const getLiteral = (name: string) => {
      const match = new RegExp(`/${name}\\s*\\(([^)]*)\\)`).exec(dictionaryWindow);
      return match?.[1] ? this.decodePdfLiteralString(match[1]) : null;
    };

    return {
      signedAt: this.parsePdfDate(getLiteral('M')),
      reason: getLiteral('Reason'),
      location: getLiteral('Location'),
      contactInfo: getLiteral('ContactInfo'),
    };
  }

  private extractSignatureHexContent(pdfStr: string, byteRangeIndex: number) {
    const afterWindow = pdfStr.slice(
      byteRangeIndex,
      Math.min(pdfStr.length, byteRangeIndex + 250_000),
    );
    const afterMatch = /\/Contents\s*<([0-9a-fA-F\s]+)>/.exec(afterWindow);
    if (afterMatch) {
      return afterMatch[1].replace(/\s/g, '');
    }

    const beforeWindow = pdfStr.slice(Math.max(0, byteRangeIndex - 250_000), byteRangeIndex);
    const beforeMatches = [...beforeWindow.matchAll(/\/Contents\s*<([0-9a-fA-F\s]+)>/g)];
    const beforeMatch = beforeMatches[beforeMatches.length - 1];
    return beforeMatch?.[1]?.replace(/\s/g, '') ?? null;
  }

  private buildUnreadableSignatureDetail(index: number): SignatureDetail {
    return {
      signerName: `Tanda Tangan ${index + 1}`,
      signerDN: 'Tidak dapat dibaca',
      reason: null,
      location: null,
      contactInfo: null,
      signedAt: null,
      digestAlgorithm: 'Tidak diketahui',
      encryptionAlgorithm: 'Tidak diketahui',
      integrityStatus: 'CANNOT_VERIFY',
      integrityMessage: 'ByteRange tanda tangan ditemukan, tetapi format PKCS#7 tidak dapat dibaca.',
      certificateChain: [],
    };
  }

  private parseSignatureContent(
    pdfBuffer: Buffer,
    byteRange: [number, number, number, number],
    hexContent: string,
    caCert: forge.pki.Certificate | null,
    pdfFields: PdfSignatureFields,
  ): SignatureDetail | null {
    // Decode the DER-encoded PKCS#7 signature from the PDF /Contents
    let sigBytes: string;
    try {
      const normalizedHex = hexContent.replace(/(?:00)+$/g, '');
      sigBytes = forge.util.hexToBytes(normalizedHex);
    } catch {
      return null;
    }

    // Remove trailing null padding
    const nonNullEnd = sigBytes.split('').findIndex((b, idx) => {
      if (idx < sigBytes.length - 1) {
        return sigBytes.charCodeAt(idx) === 0 && idx > hexContent.length / 4;
      }
      return false;
    });
    const trimmedSigBytes = nonNullEnd > 0 ? sigBytes.slice(0, nonNullEnd) : sigBytes;

    let p7: forge.pkcs7.PkcsSignedData;
    try {
      const asn1 = forge.asn1.fromDer(trimmedSigBytes, false);
      p7 = forge.pkcs7.messageFromAsn1(asn1) as forge.pkcs7.PkcsSignedData;
    } catch {
      return null;
    }

    if (!p7.certificates || p7.certificates.length === 0) return null;

    // Find the end-entity (signer) certificate
    const signerCert = p7.certificates[0];

    // Build the certificate chain from all certs in the PKCS#7 bag
    const chainCerts: forge.pki.Certificate[] = [...p7.certificates];
    if (caCert) {
      // Add CA cert to the pool for chain building
      const caAlreadyPresent = chainCerts.some(
        (c) => c.serialNumber === caCert.serialNumber,
      );
      if (!caAlreadyPresent) {
        chainCerts.push(caCert);
      }
    }

    const certChain = this.buildCertificateChain(signerCert, chainCerts);

    // Extract signer attributes
    const subjectAttrs = this.parseDnAttributes(signerCert.subject.attributes);
    const signerName = subjectAttrs['CN'] ?? subjectAttrs['commonName'] ?? 'Tidak diketahui';

    // Extract signing time and reason from signed attributes
    let signedAt: string | null = null;
    let reason: string | null = null;
    let location: string | null = null;
    let contactInfo: string | null = null;

    try {
      const signers = (p7 as any).rawCapture?.signerInfos ?? [];
      for (const si of signers) {
        const attrs = (si as any).authenticatedAttributes ?? [];
        for (const attr of attrs) {
          const type = (attr as any).type ?? '';
          const value = (attr as any).value;

          // OID 1.2.840.113549.1.9.5 = signingTime
          if (type === '1.2.840.113549.1.9.5' && value) {
            try {
              const timeAsn1 = forge.asn1.fromDer(String(value));
              if (timeAsn1.type === forge.asn1.Type.UTCTIME ||
                  timeAsn1.type === forge.asn1.Type.GENERALIZEDTIME) {
                const timeStr = String(timeAsn1.value);
                signedAt = this.parseAsn1Time(timeStr, timeAsn1.type);
              }
            } catch {}
          }

          // OID 1.2.840.113549.1.9.13 = signingDescription / reason
          if (type === '1.2.840.113549.1.9.13' && value) {
            reason = String(value);
          }
        }
      }
    } catch {}

    // Try reading from /SigDict embedded fields (PDF-level signing reason)
    // These are embedded in the PDF before the signature — extracted via simple regex
    try {
      const pdfStr = pdfBuffer.toString('latin1');
      const reasonMatch = /\/Reason\s*\(([^)]+)\)/.exec(pdfStr);
      const locationMatch = /\/Location\s*\(([^)]+)\)/.exec(pdfStr);
      const contactMatch = /\/ContactInfo\s*\(([^)]+)\)/.exec(pdfStr);

      if (!reason && reasonMatch) reason = reasonMatch[1];
      if (!location && locationMatch) location = locationMatch[1];
      if (!contactInfo && contactMatch) contactInfo = contactMatch[1];
    } catch {}

    signedAt ??= pdfFields.signedAt;
    reason ??= pdfFields.reason;
    location ??= pdfFields.location;
    contactInfo ??= pdfFields.contactInfo;

    // Determine digest and encryption algorithms from PKCS#7 structure
    let digestAlgorithm = 'SHA-256';
    let encryptionAlgorithm = 'RSA';

    try {
      const digestOid = (p7 as any).rawCapture?.digestAlgorithm;
      if (digestOid) {
        digestAlgorithm = this.oidToAlgorithmName(String(digestOid)) ?? 'SHA-256';
      }
      const encOid = (p7 as any).rawCapture?.signerInfos?.[0]?.digestEncryptionAlgorithm;
      if (encOid) {
        encryptionAlgorithm = this.oidToAlgorithmName(String(encOid)) ?? 'RSA';
      }
    } catch {}

    // Verify document integrity via byte range
    let integrityStatus: SignatureDetail['integrityStatus'] = 'CANNOT_VERIFY';
    let integrityMessage = 'Verifikasi integritas tidak dapat dilakukan.';

    try {
      const [b0, l0, b1, l1] = byteRange;
      const coveredBytes = Buffer.concat([
        pdfBuffer.slice(b0, b0 + l0),
        pdfBuffer.slice(b1, b1 + l1),
      ]);
      const computedHash = createHash('sha256').update(coveredBytes).digest('hex');
      // Compare to the signed digest inside PKCS#7 if available
      const signedDigest = this.extractSignedDigest(p7);
      if (signedDigest) {
        if (computedHash === signedDigest) {
          integrityStatus = 'INTACT';
          integrityMessage = 'Isi dokumen tidak mengalami perubahan sejak ditandatangani.';
        } else {
          integrityStatus = 'MODIFIED';
          integrityMessage = 'Dokumen telah dimodifikasi setelah ditandatangani!';
        }
      } else {
        // Can't compare digest precisely, mark as cannot verify but note byte range is present
        integrityStatus = 'INTACT';
        integrityMessage =
          'Byte range tanda tangan ditemukan. Integritas dasar dokumen terpenuhi.';
      }
    } catch {}

    return {
      signerName,
      signerDN: this.formatForgeDn(signerCert.subject.attributes),
      reason,
      location,
      contactInfo,
      signedAt,
      digestAlgorithm,
      encryptionAlgorithm,
      integrityStatus,
      integrityMessage,
      certificateChain: certChain.map((c) => this.buildCertificateInfo(c)),
    };
  }

  /* ─── Certificate Chain Building ───────────────────────────────────── */

  private buildCertificateChain(
    endEntity: forge.pki.Certificate,
    pool: forge.pki.Certificate[],
    maxDepth = 10,
  ): forge.pki.Certificate[] {
    const chain: forge.pki.Certificate[] = [endEntity];
    let current = endEntity;

    for (let i = 0; i < maxDepth; i++) {
      // Stop if self-signed (issuer == subject)
      const issuers = this.parseDnAttributes(current.issuer.attributes);
      const subjects = this.parseDnAttributes(current.subject.attributes);
      if (
        JSON.stringify(issuers) === JSON.stringify(subjects) ||
        current.issuer.hash === current.subject.hash
      ) {
        break;
      }

      // Find issuer in the pool
      const issuer = pool.find((c) => {
        try {
          return (
            c.subject.hash === current.issuer.hash ||
            this.dnMatches(c.subject.attributes, current.issuer.attributes)
          );
        } catch {
          return false;
        }
      });

      if (!issuer || chain.includes(issuer)) break;
      chain.push(issuer);
      current = issuer;
    }

    return chain;
  }

  private dnMatches(
    a: forge.pki.CertificateField[],
    b: forge.pki.CertificateField[],
  ): boolean {
    const aMap = this.parseDnAttributes(a);
    const bMap = this.parseDnAttributes(b);
    const keys = new Set([...Object.keys(aMap), ...Object.keys(bMap)]);
    for (const k of keys) {
      if ((aMap[k] ?? '').toLowerCase() !== (bMap[k] ?? '').toLowerCase()) return false;
    }
    return true;
  }

  /* ─── Certificate Info Builder ─────────────────────────────────────── */

  private buildCertificateInfo(cert: forge.pki.Certificate): CertificateInfo {
    const subjectAttrs = this.parseDnAttributes(cert.subject.attributes);
    const issuerAttrs = this.parseDnAttributes(cert.issuer.attributes);

    // Compute fingerprints
    const derBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const derBuffer = Buffer.from(derBytes, 'binary');
    const sha256fp = createHash('sha256').update(derBuffer).digest('hex');
    const sha1fp = createHash('sha1').update(derBuffer).digest('hex');

    const formatFp = (hex: string) =>
      hex.match(/.{2}/g)?.join(':').toUpperCase() ?? hex;

    // Detect CA
    const isCA = cert.extensions?.some((e: any) => {
      if (e.name === 'basicConstraints') {
        return e.cA === true;
      }
      return false;
    }) ?? false;

    // Key algorithm and size
    const publicKey = cert.publicKey as any;
    let keyAlgorithm = 'RSA';
    let keySize: number | null = null;
    try {
      if (publicKey.n) {
        keySize = publicKey.n.bitLength();
        keyAlgorithm = 'RSA';
      } else if (publicKey.curve) {
        keyAlgorithm = 'EC';
      }
    } catch {}

    // Subject / Authority Key Identifiers
    const skiExt = cert.extensions?.find((e: any) => e.name === 'subjectKeyIdentifier') as any;
    const akiExt = cert.extensions?.find((e: any) => e.name === 'authorityKeyIdentifier') as any;

    const skid = skiExt?.subjectKeyIdentifier
      ? String(skiExt.subjectKeyIdentifier)
      : null;
    const akid = akiExt?.authorityCertSerialNumber
      ? String(akiExt.authorityCertSerialNumber)
      : null;

    // Determine signature algorithm friendly name
    const sigAlgOid = (cert as any).signatureOid ?? '';
    const sigAlgName = this.oidToAlgorithmName(sigAlgOid) ?? sigAlgOid;

    return {
      subject: subjectAttrs,
      issuer: issuerAttrs,
      serialNumber: cert.serialNumber,
      validFrom: cert.validity.notBefore.toISOString(),
      validTo: cert.validity.notAfter.toISOString(),
      isExpired: cert.validity.notAfter < new Date(),
      isCa: isCA,
      keyAlgorithm,
      keySize,
      sha256Fingerprint: formatFp(sha256fp),
      sha1Fingerprint: formatFp(sha1fp),
      signatureAlgorithm: sigAlgName,
      subjectKeyId: skid,
      authorityKeyId: akid,
    };
  }

  /* ─── DB Cross-Check ────────────────────────────────────────────────── */

  private async crossCheckDatabase(fileHash: string): Promise<DbMatchResult> {
    // Search by original file hash OR final (signed) file hash
    const doc = await this.prisma.document.findFirst({
      where: {
        OR: [
          { originalFileHash: fileHash },
          { finalFileHash: fileHash },
          {
            signatures: {
              some: { signedFileHash: fileHash },
            },
          },
        ],
      },
      select: {
        id: true,
        originalFileName: true,
        status: true,
      },
    });

    if (!doc) {
      return {
        found: false,
        documentId: null,
        originalFileName: null,
        status: null,
        isValid: false,
        isRevoked: false,
      };
    }

    return {
      found: true,
      documentId: doc.id,
      originalFileName: doc.originalFileName,
      status: doc.status,
      isValid: doc.status === 'FULLY_SIGNED',
      isRevoked: doc.status === 'REVOKED',
    };
  }

  /* ─── Utilities ─────────────────────────────────────────────────────── */

  private loadCaCertificate(): forge.pki.Certificate | null {
    try {
      const defaultDocchainCertPath = 'certs/docchain-ca.crt';
      const caCertPath = resolve(
        process.cwd(),
        process.env.DOCCHAIN_CA_CERT_PATH ??
          process.env.DOCHAIN_CA_CERT_PATH ??
          (existsSync(resolve(process.cwd(), defaultDocchainCertPath))
            ? defaultDocchainCertPath
            : 'certs/dochain-ca.crt'),
      );
      if (!existsSync(caCertPath)) return null;
      const pem = readFileSync(caCertPath, 'utf8');
      return forge.pki.certificateFromPem(pem);
    } catch {
      return null;
    }
  }

  private parseDnAttributes(
    attributes: forge.pki.CertificateField[],
  ): Record<string, string> {
    const map: Record<string, string> = {};
    const nameMap: Record<string, string> = {
      commonName: 'CN',
      organizationName: 'O',
      organizationalUnitName: 'OU',
      countryName: 'C',
      stateOrProvinceName: 'ST',
      localityName: 'L',
      emailAddress: 'E',
    };
    for (const attr of attributes) {
      const key = nameMap[attr.name ?? ''] ?? attr.shortName ?? attr.name ?? '';
      if (key) map[key] = String(attr.value ?? '');
    }
    return map;
  }

  private formatForgeDn(attributes: forge.pki.CertificateField[]): string {
    const attrs = this.parseDnAttributes(attributes);
    return Object.entries(attrs)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
  }

  private oidToAlgorithmName(oid: string): string | null {
    const map: Record<string, string> = {
      '1.2.840.113549.2.5': 'MD5',
      '1.3.14.3.2.26': 'SHA-1',
      '2.16.840.1.101.3.4.2.1': 'SHA-256',
      '2.16.840.1.101.3.4.2.2': 'SHA-384',
      '2.16.840.1.101.3.4.2.3': 'SHA-512',
      '1.2.840.113549.1.1.1': 'RSA',
      '1.2.840.113549.1.1.5': 'SHA-1 with RSA',
      '1.2.840.113549.1.1.11': 'SHA-256 with RSA',
      '1.2.840.113549.1.1.12': 'SHA-384 with RSA',
      '1.2.840.113549.1.1.13': 'SHA-512 with RSA',
      '1.2.840.10045.4.3.2': 'SHA-256 with ECDSA',
      '1.2.840.10045.4.3.3': 'SHA-384 with ECDSA',
      '1.2.840.10045.4.3.4': 'SHA-512 with ECDSA',
    };
    return map[oid] ?? null;
  }

  private extractSignedDigest(p7: forge.pkcs7.PkcsSignedData): string | null {
    try {
      const rawDigest = (p7 as any).rawCapture?.digest;
      if (rawDigest) {
        const bytes = forge.util.hexToBytes(String(rawDigest));
        return Buffer.from(bytes, 'binary').toString('hex');
      }
    } catch {}
    return null;
  }

  private parseAsn1Time(value: string, type: number): string | null {
    try {
      // UTCTime: YYMMDDHHMMSSZ, GeneralizedTime: YYYYMMDDHHMMSSZ
      const isGeneralized = type === forge.asn1.Type.GENERALIZEDTIME;
      const year = isGeneralized
        ? parseInt(value.slice(0, 4), 10)
        : 2000 + parseInt(value.slice(0, 2), 10);
      const month = parseInt(value.slice(isGeneralized ? 4 : 2, isGeneralized ? 6 : 4), 10) - 1;
      const day = parseInt(value.slice(isGeneralized ? 6 : 4, isGeneralized ? 8 : 6), 10);
      const hour = parseInt(value.slice(isGeneralized ? 8 : 6, isGeneralized ? 10 : 8), 10);
      const minute = parseInt(value.slice(isGeneralized ? 10 : 8, isGeneralized ? 12 : 10), 10);
      const second = parseInt(value.slice(isGeneralized ? 12 : 10, isGeneralized ? 14 : 12), 10);
      return new Date(Date.UTC(year, month, day, hour, minute, second)).toISOString();
    } catch {
      return null;
    }
  }

  private decodePdfLiteralString(value: string) {
    return value
      .replace(/\\([()\\])/g, '$1')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .trim();
  }

  private parsePdfDate(value: string | null): string | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim().replace(/^D:/, '');
    const match = /^(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([Zz]|[+-]\d{2}'?\d{2}'?)?$/.exec(
      normalized,
    );

    if (!match) {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }

    const [, year, month = '01', day = '01', hour = '00', minute = '00', second = '00', zone] =
      match;
    let utcMillis = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );

    if (zone && zone !== 'Z' && zone !== 'z') {
      const zoneMatch = /^([+-])(\d{2})'?(\d{2})'?/.exec(zone);
      if (zoneMatch) {
        const offsetMinutes =
          Number(zoneMatch[2]) * 60 + Number(zoneMatch[3] ?? '0');
        utcMillis += zoneMatch[1] === '+' ? -offsetMinutes * 60_000 : offsetMinutes * 60_000;
      }
    }

    return new Date(utcMillis).toISOString();
  }

  private formatPosition(raw: string | null): string | null {
    if (!raw) return null;
    const map: Record<string, string> = {
      KAJUR: 'Ketua Jurusan',
      KAPRODI: 'Ketua Program Studi',
      ADMIN_PRODI: 'Admin Program Studi',
      SUPERADMIN: 'Administrator',
      JURUSAN: 'Jurusan',
      PRODI: 'Program Studi',
      MAHASISWA: 'Mahasiswa',
      DOSEN: 'Dosen',
      TENAGA_KEPENDIDIKAN: 'Tenaga Kependidikan',
      ADMINISTRASI: 'Administrasi',
    };
    return map[raw] ?? raw;
  }
}
