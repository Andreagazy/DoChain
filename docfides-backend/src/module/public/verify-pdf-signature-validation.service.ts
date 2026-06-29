import { Injectable, Logger } from '@nestjs/common';
import type { CertificateInfo, SignatureDetail } from './public.service';

type VerifyPdfCertificateResult = {
  clientCertificate?: boolean;
  issuedBy?: Record<string, unknown>;
  issuedTo?: Record<string, unknown>;
  validityPeriod?: {
    notBefore?: string | Date;
    notAfter?: string | Date;
  };
};

type VerifyPdfSignatureResult = {
  verified?: boolean;
  authenticity?: boolean;
  integrity?: boolean;
  expired?: boolean;
  message?: string;
  meta?: {
    certs?: VerifyPdfCertificateResult[];
    signatureMeta?: {
      contactInfo?: string | null;
      reason?: string | null;
      location?: string | null;
      name?: string | null;
    };
  };
};

type VerifyPdfResult = {
  verified?: boolean;
  authenticity?: boolean;
  integrity?: boolean;
  expired?: boolean;
  message?: string;
  signatures?: VerifyPdfSignatureResult[];
};

@Injectable()
export class VerifyPdfSignatureValidationService {
  private readonly logger = new Logger(VerifyPdfSignatureValidationService.name);

  async validate(pdfBuffer: Buffer): Promise<SignatureDetail[] | null> {
    try {
      const verifyPdfModule = await import('@qlever-llc/verify-pdf');
      const verifyPdf = verifyPdfModule.default as (pdf: Uint8Array) => VerifyPdfResult;
      const result = verifyPdf(pdfBuffer);

      if (!result.signatures?.length) {
        return null;
      }

      return result.signatures.map((signature, index) =>
        this.mapSignature(signature, index),
      );
    } catch (error) {
      this.logger.warn(
        `Validasi signature dengan verify-pdf gagal: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private mapSignature(
    signature: VerifyPdfSignatureResult,
    index: number,
  ): SignatureDetail {
    const certs = signature.meta?.certs ?? [];
    const signerCert =
      certs.find((certificate) => certificate.clientCertificate) ?? certs[0] ?? null;
    const signatureMeta = signature.meta?.signatureMeta;
    const signerName =
      signatureMeta?.name ??
      this.getCertName(signerCert?.issuedTo) ??
      `Tanda Tangan ${index + 1}`;

    return {
      signerName,
      signerDN: this.formatDn(signerCert?.issuedTo) ?? 'Tidak diketahui',
      reason: signatureMeta?.reason ?? null,
      location: signatureMeta?.location ?? null,
      contactInfo: signatureMeta?.contactInfo ?? null,
      signedAt: null,
      digestAlgorithm: 'Tidak diketahui',
      encryptionAlgorithm: 'Tidak diketahui',
      integrityStatus: this.mapIntegrity(signature),
      integrityMessage: this.buildIntegrityMessage(signature),
      certificateChain: certs.map((certificate) => this.mapCertificate(certificate)),
    };
  }

  private mapIntegrity(
    signature: VerifyPdfSignatureResult,
  ): SignatureDetail['integrityStatus'] {
    if (signature.integrity === false) {
      return 'MODIFIED';
    }

    if (signature.integrity === true) {
      return 'INTACT';
    }

    return 'CANNOT_VERIFY';
  }

  private buildIntegrityMessage(signature: VerifyPdfSignatureResult) {
    if (signature.integrity === false) {
      return 'Dokumen telah dimodifikasi setelah tanda tangan digital dibuat.';
    }

    if (signature.integrity === true && signature.verified === true) {
      return 'Tanda tangan digital valid dan isi dokumen tidak berubah.';
    }

    if (signature.integrity === true && signature.expired === true) {
      return 'Isi dokumen tidak berubah, tetapi sertifikat tanda tangan sudah kedaluwarsa.';
    }

    if (signature.integrity === true && signature.authenticity === false) {
      return 'Isi dokumen tidak berubah, tetapi rantai sertifikat tidak dapat dipercaya sepenuhnya.';
    }

    return signature.message ?? 'Status integritas tanda tangan tidak dapat dipastikan.';
  }

  private mapCertificate(certificate: VerifyPdfCertificateResult): CertificateInfo {
    const validFrom = this.toIsoDate(certificate.validityPeriod?.notBefore);
    const validTo = this.toIsoDate(certificate.validityPeriod?.notAfter);

    return {
      subject: this.normalizeRecord(certificate.issuedTo),
      issuer: this.normalizeRecord(certificate.issuedBy),
      serialNumber: '',
      validFrom,
      validTo,
      isExpired: validTo ? new Date(validTo).getTime() < Date.now() : false,
      isCa: !certificate.clientCertificate,
      keyAlgorithm: 'Tidak diketahui',
      keySize: null,
      sha256Fingerprint: '',
      sha1Fingerprint: '',
      signatureAlgorithm: 'Tidak diketahui',
      subjectKeyId: null,
      authorityKeyId: null,
    };
  }

  private getCertName(record?: Record<string, unknown>) {
    if (!record) {
      return null;
    }

    const candidates = ['commonName', 'CN', 'name', 'organizationName', 'O'];
    for (const key of candidates) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return null;
  }

  private formatDn(record?: Record<string, unknown>) {
    if (!record) {
      return null;
    }

    const entries = Object.entries(record)
      .filter(([, value]) => value != null && String(value).trim())
      .map(([key, value]) => `${key}=${String(value)}`);

    return entries.length ? entries.join(', ') : null;
  }

  private normalizeRecord(record?: Record<string, unknown>) {
    if (!record) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(record).map(([key, value]) => [key, String(value ?? '')]),
    );
  }

  private toIsoDate(value?: string | Date) {
    if (!value) {
      return '';
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
  }
}
