export interface RegisterDto {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RequestOtpDto {
  email: string;
}

export interface VerifyOtpDto {
  email: string;
  otp: string;
}

export interface User {
  id: string;
  email: string;
  role: string;
  displayName?: string | null;
  identityStatus?: IdentityStatus | null;
}

export type IdentityStatus =
  | 'NOT_SUBMITTED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED';

export interface IdentityStatusResponse {
  status: IdentityStatus;
  canCertify: boolean;
  reason: string | null;
}

export interface IdentityProfileResponse {
  identityExists: boolean;
  status: IdentityStatus;
  userId?: string;
  nik?: string;
  fullName?: string;
  birthPlace?: string | null;
  birthDate?: string;
  address?: string;
  ktpOriginalFileName?: string | null;
  ktpStoredFileName?: string | null;
  ktpStoragePath?: string | null;
  ktpMimeType?: string | null;
  ktpSizeBytes?: number | null;
  ktpUploadedAt?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  updatedAt?: string;
}

export interface SubmitIdentityDto {
  nik: string;
  fullName: string;
  birthPlace?: string;
  birthDate: string;
  address: string;
}

export interface PendingIdentityItem {
  userId: string;
  nik: string;
  fullName: string;
  birthDate: string;
  updatedAt: string;
}

export interface ReviewIdentityDto {
  status: 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
}

export interface AuthResponse {
  message: string;
  access_token: string;
  user: User;
}

export interface OtpResponse {
  message: string;
  remainingAttempts?: number;
  nextRetryAt?: string;
}

export type SignatureMode = 'visible' | 'invisible';

export interface CertificationDocumentSummary {
  id: string;
  status: string;
  originalFileName?: string | null;
  updatedAt?: string;
}

export interface CertificationEligibilityResponse {
  canStartCertification: boolean;
  canSignCertification: boolean;
  reason: string | null;
  document: CertificationDocumentSummary;
}

export interface RequestSignersPayload {
  signerUserIds: string[];
  placeholders?: Array<{
    signerUserId: string;
    visiblePage?: number;
    visibleX?: number;
    visibleY?: number;
    visibleWidth?: number;
    visibleHeight?: number;
  }>;
}

export interface RequestSignersResponse {
  message: string;
  document: {
    id: string;
    status: string;
    updatedAt?: string;
  };
  signers: Array<{
    userId: string;
    email: string | null;
    displayName: string | null;
    preferredSignatureMode: SignatureMode;
    status: string;
    order: number | null;
    action: 'invited' | 're-requested' | 'already-exists' | 'updated';
    placeholder: {
      visiblePage: number | null;
      visibleX: number | null;
      visibleY: number | null;
      visibleWidth: number | null;
      visibleHeight: number | null;
    };
  }>;
}

export interface DocumentSignerPlaceholdersResponse {
  documentId: string;
  signers: Array<{
    userId: string;
    order: number | null;
    status: string;
    email: string | null;
    displayName: string | null;
    placeholder: {
      visiblePage: number | null;
      visibleX: number | null;
      visibleY: number | null;
      visibleWidth: number | null;
      visibleHeight: number | null;
    };
  }>;
}

export interface StartCertificationResponse {
  message: string;
  document: {
    id: string;
    status: string;
    updatedAt?: string;
  };
}

export interface UploadSignatureResponse {
  message: string;
  signature: {
    originalFileName: string;
    storedFileName: string;
    mimeType: string;
    sizeBytes: number;
    storagePath: string;
  };
  userId: string;
}

export interface SignatureStatusResponse {
  hasSignature: boolean;
  signature: {
    fileName: string | null;
    storagePath: string;
  } | null;
  preferredSignatureMode: SignatureMode;
}

export interface SignaturePreferenceResponse {
  message: string;
  userId: string;
  preferredSignatureMode: SignatureMode;
  updatedAt: string;
}

export interface UploadDocumentResponse {
  id: string;
  status: string;
  originalFileName: string | null;
  originalFileSize: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface OwnedDocumentItem {
  id: string;
  status: string;
  originalFileName: string | null;
  finalFileName: string | null;
  requiredSignerCount: number;
  updatedAt: string;
}

export interface OwnedDocumentsResponse {
  documents: OwnedDocumentItem[];
}

export interface AssignedDocumentItem {
  signerStatus: string;
  order: number | null;
  updatedAt: string;
  document: {
    id: string;
    status: string;
    originalFileName: string | null;
    finalFileName: string | null;
    ownerEmail: string | null;
    ownerDisplayName: string | null;
  };
}

export interface AssignedDocumentsResponse {
  assignments: AssignedDocumentItem[];
}

export interface SignerCandidate {
  id: string;
  email: string;
  displayName: string | null;
  preferredSignatureMode: SignatureMode;
}

export interface SignerCandidatesResponse {
  signers: SignerCandidate[];
}

export interface SignDocumentPayload {
  mode: SignatureMode;
  reason?: string;
  visiblePage?: number;
  visibleX?: number;
  visibleY?: number;
  visibleWidth?: number;
  visibleHeight?: number;
}

export interface SignDocumentResponse {
  message: string;
  mode: SignatureMode;
  signedFile: {
    fileName: string;
    storagePath: string;
    hash: string;
    sizeBytes: number;
  };
  signature: {
    id: string;
    order: number;
    signedAt: string;
  };
  document: {
    id: string;
    status: string;
    finalFileName: string;
    finalFileHash: string;
    finalFileSize: number;
    updatedAt: string;
  };
}
