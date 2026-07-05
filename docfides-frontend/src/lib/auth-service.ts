import api from './axios';
import {
    clearAuthSession,
    getStoredToken,
    isAuthSessionIdleExpired,
    saveAuthSession,
} from './auth-session';
import {
    RequestOtpDto,
    VerifyOtpDto,
    RegisterDto,
    RegisterOptionsResponse,
    LoginDto,
    AuthResponse,
    ChangePasswordPayload,
    OtpResponse,
    User,
    IdentityStatusResponse,
    IdentityProfileResponse,
    SubmitIdentityDto,
    PendingIdentityItem,
    ReviewIdentityDto,
    CertificationEligibilityResponse,
    StartCertificationResponse,
    UploadSignatureResponse,
    SignaturePreferenceResponse,
    SignatureStatusResponse,
    SignDocumentPayload,
    SignDocumentResponse,
    FinalizeQrPayload,
    FinalizeQrResponse,
    DeclineDocumentPayload,
    RequestSignersPayload,
    RequestSignersResponse,
    CertificationDocumentDetailResponse,
    UploadDocumentResponse,
    OwnedDocumentsResponse,
    AssignedDocumentsResponse,
    SignerCandidatesResponse,
    DocumentSignerPlaceholdersResponse,
    AdminOverviewResponse,
    AdminAcademicUnitsResponse,
    AdminAcademicUnit,
    CreateAdminAcademicUnitPayload,
    UpdateAdminAcademicUnitPayload,
    AdminUsersResponse,
    AdminUserItem,
    CreateAdminUserPayload,
    UpdateAdminUserPayload,
    AdminIdentitiesResponse,
    AdminDocumentsResponse,
    RevokeAdminDocumentPayload,
    RevokeAdminDocumentResponse,
    IpfsStatusResponse,
    NotificationsResponse,
    UpdateProfilePayload,
    IdentityChangeRequestItem,
    AcademicProfileChangePayload,
    AcademicProfileChangeRequestItem,
    AdminDocumentRevokeRequestsResponse,
    RequestDocumentRevokeResponse,
    ReviewDocumentRevokeRequestPayload,
} from '@/types/auth';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Request OTP untuk email tertentu
 */
export const requestOtp = async (dto: RequestOtpDto): Promise<OtpResponse> => {
    const response = await api.post<OtpResponse>('/auth/request-otp', {
        ...dto,
        email: normalizeEmail(dto.email),
    });
    return response.data;
};

/**
 * Verify OTP yang dikirim ke email
 */
export const verifyOtp = async (dto: VerifyOtpDto): Promise<OtpResponse> => {
    const response = await api.post<OtpResponse>('/auth/verify-otp', {
        ...dto,
        email: normalizeEmail(dto.email),
    });
    return response.data;
};

/**
 * Register user dengan email yang sudah diverifikasi
 */
export const register = async (
    dto: RegisterDto,
): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', {
        ...dto,
        email: normalizeEmail(dto.email),
    });
    return response.data;
};

/**
 * Login user
 */
export const login = async (dto: LoginDto): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', {
        ...dto,
        email: normalizeEmail(dto.email),
    });
    return response.data;
};

/**
 * Logout user (clear token from localStorage)
 */
export const logout = (): void => {
    clearAuthSession();
};

/**
 * Get stored token
 */
export const getToken = (): string | null => {
    if (isAuthSessionIdleExpired()) {
        logout();
        return null;
    }

    return getStoredToken();
};

export const getDefaultHomePath = (user: User | null): string => {
    if (user?.role === 'SUPERADMIN') return '/admin';
    if (user?.role === 'ADMIN_PRODI') return '/admin-prodi';
    return '/dashboard';
};

/**
 * Get stored user
 */
export const getUser = (): User | null => {
    if (typeof window !== 'undefined') {
        const user = localStorage.getItem('user');
        return user ? (JSON.parse(user) as User) : null;
    }
    return null;
};

/**
 * Save token and user to localStorage
 */
export const saveAuthData = (token: string, user: User): void => {
    saveAuthSession(token, JSON.stringify(user));
};

export const getProfile = async (): Promise<User> => {
    const response = await api.get<User>('/auth/me');
    return response.data;
};

export const getRegisterOptions = async (): Promise<RegisterOptionsResponse> => {
    const response = await api.get<RegisterOptionsResponse>('/auth/register-options');
    return response.data;
};

export const updateProfile = async (
    payload: UpdateProfilePayload,
): Promise<{ message: string; user: User }> => {
    const response = await api.patch<{ message: string; user: User }>('/auth/profile', payload);
    return response.data;
};

export const changePassword = async (
    payload: ChangePasswordPayload,
): Promise<{ message: string }> => {
    const response = await api.patch<{ message: string }>('/auth/password', payload);
    return response.data;
};

export const requestAcademicProfileChange = async (
    payload: AcademicProfileChangePayload,
): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>(
        '/auth/academic-profile/change-request',
        payload,
    );
    return response.data;
};

export const getIdentityStatus = async (): Promise<IdentityStatusResponse> => {
    const response = await api.get<IdentityStatusResponse>('/identity/status');
    return response.data;
};

export const getIdentityProfile = async (): Promise<IdentityProfileResponse> => {
    const response = await api.get<IdentityProfileResponse>('/identity/me');
    return response.data;
};

export const submitIdentity = async (
    dto: SubmitIdentityDto,
    ktpFile?: File,
): Promise<{ message: string }> => {
    const formData = new FormData();
    formData.append('nik', dto.nik);
    formData.append('fullName', dto.fullName);
    formData.append('birthPlace', dto.birthPlace);
    formData.append('birthDate', dto.birthDate);
    formData.append('address', dto.address);

    if (ktpFile) {
        formData.append('ktpFile', ktpFile);
    }

    const response = await api.post<{ message: string }>('/identity/submit', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export const startDocumentCertification = async (
    documentId: string,
): Promise<StartCertificationResponse> => {
    const response = await api.post<StartCertificationResponse>(
        `/certification/documents/${documentId}/start`,
    );
    return response.data;
};

export const getCertificationEligibility = async (
    documentId: string,
): Promise<CertificationEligibilityResponse> => {
    const response = await api.get<CertificationEligibilityResponse>(
        `/certification/documents/${documentId}/eligibility`,
    );
    return response.data;
};

export const uploadSignatureImage = async (
    signatureFile: File,
): Promise<UploadSignatureResponse> => {
    const formData = new FormData();
    formData.append('signatureFile', signatureFile);

    const response = await api.post<UploadSignatureResponse>(
        '/certification/signature/upload',
        formData,
        {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        },
    );

    return response.data;
};

export const updateSignaturePreference = async (
    mode: 'visible' | 'invisible',
): Promise<SignaturePreferenceResponse> => {
    const response = await api.patch<SignaturePreferenceResponse>(
        '/certification/signature/preference',
        { mode },
    );

    return response.data;
};

export const getSignatureStatus = async (): Promise<SignatureStatusResponse> => {
    const response = await api.get<SignatureStatusResponse>('/certification/signature/me');
    return response.data;
};

export const getSignatureImageFile = async (): Promise<Blob> => {
    const response = await api.get('/certification/signature/file', {
        responseType: 'blob',
    });

    return response.data as Blob;
};

export const getIpfsStatus = async (): Promise<IpfsStatusResponse> => {
    const response = await api.get<IpfsStatusResponse>('/certification/ipfs/status');
    return response.data;
};

export const getIpfsFile = async (cid: string): Promise<Blob> => {
    const response = await api.get(`/certification/ipfs/${encodeURIComponent(cid)}/file`, {
        responseType: 'blob',
    });

    return response.data as Blob;
};

export const uploadDocumentForCertification = async (
    documentFile: File,
): Promise<UploadDocumentResponse> => {
    const formData = new FormData();
    formData.append('documentFile', documentFile);

    const response = await api.post<UploadDocumentResponse>(
        '/certification/documents/upload',
        formData,
        {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        },
    );

    return response.data;
};

export const listMyCertificationDocuments = async (): Promise<OwnedDocumentsResponse> => {
    const response = await api.get<OwnedDocumentsResponse>('/certification/documents/my');
    return response.data;
};

export const getCertificationDocumentDetail = async (
    documentId: string,
): Promise<CertificationDocumentDetailResponse> => {
    const response = await api.get<CertificationDocumentDetailResponse>(
        `/certification/documents/${documentId}`,
    );
    return response.data;
};

export const listAssignedCertificationDocuments = async (): Promise<AssignedDocumentsResponse> => {
    const response = await api.get<AssignedDocumentsResponse>('/certification/documents/assigned');
    return response.data;
};

export const listNotifications = async (): Promise<NotificationsResponse> => {
    const response = await api.get<NotificationsResponse>('/certification/notifications');
    return response.data;
};

export const getCertificationDocumentFile = async (documentId: string): Promise<Blob> => {
    const response = await api.get(`/certification/documents/${documentId}/file`, {
        responseType: 'blob',
    });

    return response.data as Blob;
};

export const getCertificationDocumentOriginalFile = async (documentId: string): Promise<Blob> => {
    const response = await api.get(`/certification/documents/${documentId}/file/original`, {
        responseType: 'blob',
    });

    return response.data as Blob;
};

export const getCertificationDocumentSignedFile = async (documentId: string): Promise<Blob> => {
    const response = await api.get(`/certification/documents/${documentId}/file/signed`, {
        responseType: 'blob',
    });

    return response.data as Blob;
};

export const deleteDraftCertificationDocument = async (
    documentId: string,
): Promise<{ message: string }> => {
    const response = await api.delete<{ message: string }>(
        `/certification/documents/${documentId}`,
    );
    return response.data;
};

export const listSignerCandidates = async (): Promise<SignerCandidatesResponse> => {
    const response = await api.get<SignerCandidatesResponse>('/certification/signers/candidates');
    return response.data;
};

export const signDocumentCertification = async (
    documentId: string,
    payload: SignDocumentPayload,
): Promise<SignDocumentResponse> => {
    const response = await api.post<SignDocumentResponse>(
        `/certification/documents/${documentId}/sign`,
        payload,
    );
    return response.data;
};

export const finalizeDocumentQr = async (
    documentId: string,
    payload: FinalizeQrPayload,
): Promise<FinalizeQrResponse> => {
    const response = await api.post<FinalizeQrResponse>(
        `/certification/documents/${documentId}/finalize-qr`,
        payload,
    );
    return response.data;
};

export const declineDocumentCertification = async (
    documentId: string,
    payload: DeclineDocumentPayload,
): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>(
        `/certification/documents/${documentId}/decline`,
        payload,
    );
    return response.data;
};

export const requestDocumentSigners = async (
    documentId: string,
    payload: RequestSignersPayload,
): Promise<RequestSignersResponse> => {
    const response = await api.post<RequestSignersResponse>(
        `/certification/documents/${documentId}/request-signers`,
        payload,
    );
    return response.data;
};

export const getDocumentSignerPlaceholders = async (
    documentId: string,
): Promise<DocumentSignerPlaceholdersResponse> => {
    const response = await api.get<DocumentSignerPlaceholdersResponse>(
        `/certification/documents/${documentId}/placeholders`,
    );
    return response.data;
};

export const listPendingIdentities = async (): Promise<PendingIdentityItem[]> => {
    const response = await api.get<PendingIdentityItem[]>('/identity/pending');
    return response.data;
};

export const reviewIdentity = async (
    userId: string,
    dto: ReviewIdentityDto,
): Promise<{ message: string }> => {
    const response = await api.patch<{ message: string }>(`/identity/${userId}/review`, dto);
    return response.data;
};

export const getIdentityKtpFile = async (userId: string): Promise<Blob> => {
    const response = await api.get(`/identity/${userId}/ktp`, {
        responseType: 'blob',
    });
    return response.data as Blob;
};

export const getAdminOverview = async (): Promise<AdminOverviewResponse> => {
    const response = await api.get<AdminOverviewResponse>('/admin/overview');
    return response.data;
};

export const listAdminAcademicUnits = async (): Promise<AdminAcademicUnitsResponse> => {
    const response = await api.get<AdminAcademicUnitsResponse>('/admin/academic-units');
    return response.data;
};

export const getAdminAcademicUnit = async (
    unitId: string,
): Promise<{ unit: AdminAcademicUnit }> => {
    const response = await api.get<{ unit: AdminAcademicUnit }>(`/admin/academic-units/${unitId}`);
    return response.data;
};

export const createAdminAcademicUnit = async (
    payload: CreateAdminAcademicUnitPayload,
): Promise<{ unit: AdminAcademicUnit }> => {
    const response = await api.post<{ unit: AdminAcademicUnit }>('/admin/academic-units', payload);
    return response.data;
};

export const updateAdminAcademicUnit = async (
    unitId: string,
    payload: UpdateAdminAcademicUnitPayload,
): Promise<{ unit: AdminAcademicUnit }> => {
    const response = await api.patch<{ unit: AdminAcademicUnit }>(
        `/admin/academic-units/${unitId}`,
        payload,
    );
    return response.data;
};

export const deleteAdminAcademicUnit = async (
    unitId: string,
): Promise<{ unit: AdminAcademicUnit; message: string }> => {
    const response = await api.delete<{ unit: AdminAcademicUnit; message: string }>(
        `/admin/academic-units/${unitId}`,
    );
    return response.data;
};

export const listAdminUsers = async (): Promise<AdminUsersResponse> => {
    const response = await api.get<AdminUsersResponse>('/admin/users');
    return response.data;
};

export const getAdminUser = async (
    userId: string,
): Promise<{ user: AdminUserItem }> => {
    const response = await api.get<{ user: AdminUserItem }>(`/admin/users/${userId}`);
    return response.data;
};

export const createAdminUser = async (
    payload: CreateAdminUserPayload,
): Promise<{ user: AdminUserItem }> => {
    const response = await api.post<{ user: AdminUserItem }>('/admin/users', {
        ...payload,
        email: normalizeEmail(payload.email),
    });
    return response.data;
};

export const updateAdminUser = async (
    userId: string,
    payload: UpdateAdminUserPayload,
): Promise<{ user: AdminUserItem }> => {
    const response = await api.patch<{ user: AdminUserItem }>(`/admin/users/${userId}`, payload);
    return response.data;
};

export const deleteAdminUser = async (
    userId: string,
): Promise<{ user: AdminUserItem; message: string }> => {
    const response = await api.delete<{ user: AdminUserItem; message: string }>(
        `/admin/users/${userId}`,
    );
    return response.data;
};

export const resetAdminUserPassword = async (
    userId: string,
    password?: string,
): Promise<{ message: string }> => {
    const response = await api.patch<{ message: string }>(`/admin/users/${userId}/password`, {
        password,
    });
    return response.data;
};

export const listAcademicProfileChangeRequests = async (): Promise<AcademicProfileChangeRequestItem[]> => {
    const response = await api.get<{ requests: AcademicProfileChangeRequestItem[] }>(
        '/admin/academic-profile-change-requests',
    );
    return response.data.requests;
};

export const reviewAcademicProfileChangeRequest = async (
    requestId: string,
    payload: ReviewIdentityDto,
): Promise<{ message: string }> => {
    const response = await api.patch<{ message: string }>(
        `/admin/academic-profile-change-requests/${requestId}/review`,
        payload,
    );
    return response.data;
};

export const listAdminIdentities = async (): Promise<AdminIdentitiesResponse> => {
    const response = await api.get<AdminIdentitiesResponse>('/admin/identities');
    return response.data;
};

export const reviewAdminIdentity = async (
    userId: string,
    payload: ReviewIdentityDto,
): Promise<{ message: string }> => {
    const response = await api.patch<{ message: string }>(`/admin/identities/${userId}/review`, payload);
    return response.data;
};

export const listIdentityChangeRequests = async (): Promise<IdentityChangeRequestItem[]> => {
    const response = await api.get<IdentityChangeRequestItem[]>('/identity/change-requests/pending');
    return response.data;
};

export const reviewIdentityChangeRequest = async (
    requestId: string,
    payload: ReviewIdentityDto,
): Promise<{ message: string }> => {
    const response = await api.patch<{ message: string }>(
        `/identity/change-requests/${requestId}/review`,
        payload,
    );
    return response.data;
};

export const getIdentityChangeRequestKtpFile = async (requestId: string): Promise<Blob> => {
    const response = await api.get(`/identity/change-requests/${requestId}/ktp`, {
        responseType: 'blob',
    });
    return response.data as Blob;
};

export const listAdminDocuments = async (): Promise<AdminDocumentsResponse> => {
    const response = await api.get<AdminDocumentsResponse>('/admin/documents');
    return response.data;
};

export const getAdminDocumentFile = async (documentId: string): Promise<Blob> => {
    const response = await api.get(`/admin/documents/${documentId}/file`, {
        responseType: 'blob',
    });

    return response.data as Blob;
};

export const revokeAdminDocument = async (
    documentId: string,
    payload: RevokeAdminDocumentPayload,
): Promise<RevokeAdminDocumentResponse> => {
    const response = await api.delete<RevokeAdminDocumentResponse>(
        `/admin/documents/${documentId}`,
        { data: payload },
    );
    return response.data;
};

export const requestDocumentRevoke = async (
    documentId: string,
    reason: string,
    evidenceImages: File[],
): Promise<RequestDocumentRevokeResponse> => {
    const formData = new FormData();
    formData.append('reason', reason);
    evidenceImages.forEach((file) => formData.append('evidenceImages', file));

    const response = await api.post<RequestDocumentRevokeResponse>(
        `/certification/documents/${documentId}/revoke-requests`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
};

export const listAdminDocumentRevokeRequests = async (): Promise<AdminDocumentRevokeRequestsResponse> => {
    const response = await api.get<AdminDocumentRevokeRequestsResponse>('/admin/document-revoke-requests');
    return response.data;
};

export const getAdminDocumentRevokeEvidence = async (
    requestId: string,
    evidenceId: string,
): Promise<Blob> => {
    const response = await api.get(
        `/admin/document-revoke-requests/${requestId}/evidences/${evidenceId}`,
        { responseType: 'blob' },
    );
    return response.data as Blob;
};

export const reviewAdminDocumentRevokeRequest = async (
    requestId: string,
    payload: ReviewDocumentRevokeRequestPayload,
): Promise<{ message: string }> => {
    const response = await api.patch<{ message: string }>(
        `/admin/document-revoke-requests/${requestId}/review`,
        payload,
    );
    return response.data;
};
