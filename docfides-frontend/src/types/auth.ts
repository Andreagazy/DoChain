export interface RegisterDto {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  nim: string;
  prodiId: string;
  angkatan?: number;
  kelas?: string;
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
  role: UserRole;
  displayName?: string | null;
  identityStatus?: IdentityStatus | null;
  academicProfile?: AcademicProfile | null;
}

export type UserRole =
  | 'SUPERADMIN'
  | 'JURUSAN'
  | 'PRODI'
  | 'ADMIN_PRODI'
  | 'PEGAWAI'
  | 'MAHASISWA';

export interface AcademicProfile {
  type: 'STUDENT' | 'EMPLOYEE';
  identifier?: string | null;
  unitCode: string;
  unitName: string;
  unitType: 'JURUSAN' | 'PRODI';
  angkatan?: number | null;
  kelas?: string | null;
  employeeType?: string;
  positionTitle?: string | null;
  label?: string;
  structuralPositions?: Array<{
    position: string;
    academicUnit: {
      code: string;
      name: string;
      type: 'JURUSAN' | 'PRODI';
    };
  }>;
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
  birthPlace: string;
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

export interface RegisterOptionsResponse {
  prodi: Array<{
    id: string;
    code: string;
    name: string;
    parentId: string | null;
  }>;
}

export interface UpdateProfilePayload {
  displayName?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
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
    role?: UserRole | null;
    signerLevel?: number | null;
    academicProfile?: AcademicProfile | null;
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
  finalFileIpfsHash?: string | null;
  finalFileIpfsGatewayUrl?: string | null;
  hasVerificationQr?: boolean;
  requiredSignerCount: number;
  signatureCount?: number;
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
  role: UserRole;
  signerLevel: number;
  academicProfile?: AcademicProfile | null;
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
    ipfsHash?: string | null;
    ipfsGatewayUrl?: string | null;
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
    finalFileIpfsHash?: string | null;
    finalFileSize: number;
    updatedAt: string;
  };
}

export interface FinalizeQrPayload {
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface FinalizeQrResponse {
  message: string;
  document: {
    id: string;
    status: string;
    finalFileName: string;
    finalFileHash: string;
    finalFileIpfsHash?: string | null;
    finalFileSize: number;
    updatedAt: string;
  };
  file: {
    fileName: string;
    storagePath: string;
    hash: string;
    ipfsHash?: string | null;
    ipfsGatewayUrl?: string | null;
    blockchainTxHash?: string | null;
    sizeBytes: number;
  };
}

export interface DeclineDocumentPayload {
  reason: string;
}

export interface IpfsStatusResponse {
  configured: boolean;
  connected: boolean;
  apiUrl: string | null;
  gatewayUrl: string | null;
  version: string | null;
  error: string | null;
}

export interface AdminAcademicUnit {
  id: string;
  code: string;
  name: string;
  type: 'JURUSAN' | 'PRODI';
  parentId: string | null;
  isActive: boolean;
}

export interface AdminUserItem {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  emailVerifiedAt: string | null;
  createdAt: string;
  identity: {
    status: IdentityStatus;
    fullName: string;
    nik: string;
  } | null;
  studentProfile: {
    nim: string;
    angkatan: number | null;
    kelas: string | null;
    prodi: AdminAcademicUnit;
  } | null;
  employeeProfile: {
    nip: string | null;
    nidn: string | null;
    employeeType: 'DOSEN' | 'TENAGA_KEPENDIDIKAN' | 'ADMINISTRASI';
    positionTitle: string | null;
    homeUnit: AdminAcademicUnit;
  } | null;
  structuralAssignments: Array<{
    position: 'KAJUR' | 'KAPRODI' | 'ADMIN_PRODI';
    academicUnit: AdminAcademicUnit;
  }>;
}

export interface AdminUsersResponse {
  users: AdminUserItem[];
}

export interface AdminAcademicUnitsResponse {
  units: AdminAcademicUnit[];
}

export interface AdminOverviewResponse {
  users: {
    total: number;
    active: number;
    byRole: Array<{ role: UserRole; count: number }>;
  };
  identities: {
    pending: number;
  };
  documents: {
    total: number;
    fullySigned: number;
    revoked: number;
    declinedSigners: number;
    byStatus: Array<{ status: string; count: number }>;
  };
}

export interface AdminIdentitiesResponse {
  identities: Array<{
    userId: string;
    nik: string;
    fullName: string;
    birthPlace: string | null;
    birthDate: string;
    address: string;
    ktpOriginalFileName: string | null;
    ktpStoragePath: string | null;
    status: IdentityStatus;
    verifiedBy: string | null;
    verifiedAt: string | null;
    updatedAt: string;
    user: {
      email: string;
      displayName: string | null;
      role: UserRole;
      status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
    };
  }>;
}

export interface UpdateAdminUserPayload {
  displayName?: string | null;
  certificateFullName?: string | null;
  role?: UserRole;
  status?: 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  studentProfile?: {
    nim: string;
    prodiId: string;
    angkatan?: number | null;
    kelas?: string | null;
  } | null;
  employeeProfile?: {
    nip?: string | null;
    nidn?: string | null;
    employeeType: 'DOSEN' | 'TENAGA_KEPENDIDIKAN' | 'ADMINISTRASI';
    homeUnitId: string;
    positionTitle?: string | null;
  } | null;
  structuralAssignments?: Array<{
    academicUnitId: string;
    position: 'KAJUR' | 'KAPRODI' | 'ADMIN_PRODI';
  }>;
}

export interface CreateAdminUserPayload {
  email: string;
  displayName: string;
  role: UserRole;
  password?: string;
}

export interface CreateAdminAcademicUnitPayload {
  code: string;
  name: string;
  type: 'JURUSAN' | 'PRODI';
  parentId?: string | null;
}

export interface UpdateAdminAcademicUnitPayload {
  code?: string;
  name?: string;
  parentId?: string | null;
  isActive?: boolean;
}

export interface AdminDocumentsResponse {
  documents: Array<{
    id: string;
    originalFileName: string | null;
    finalFileName: string | null;
    status: string;
    finalFileHash: string | null;
    finalFileIpfsHash: string | null;
    revokedAt: string | null;
    revokeReason: string | null;
    revokedBy: {
      email: string;
      displayName: string | null;
      role: UserRole;
    } | null;
    createdAt: string;
    updatedAt: string;
    user: {
      email: string;
      displayName: string | null;
    } | null;
    requiredSigners: Array<{
      status: string;
      order: number | null;
      signedAt: string | null;
      declinedAt: string | null;
      declineReason: string | null;
      user: {
        email: string;
        displayName: string | null;
        role: UserRole;
      };
    }>;
  }>;
}

export interface RevokeAdminDocumentPayload {
  reason: string;
}

export interface RevokeAdminDocumentResponse {
  message: string;
  document: AdminDocumentsResponse['documents'][number];
}
