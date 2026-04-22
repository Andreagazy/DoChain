import api from './axios';
import {
    RequestOtpDto,
    VerifyOtpDto,
    RegisterDto,
    LoginDto,
    AuthResponse,
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
    SignatureStatusResponse,
    SignDocumentPayload,
    SignDocumentResponse,
    RequestSignersPayload,
    RequestSignersResponse,
    UploadDocumentResponse,
    OwnedDocumentsResponse,
    AssignedDocumentsResponse,
    SignerCandidatesResponse,
} from '@/types/auth';

/**
 * Request OTP untuk email tertentu
 */
export const requestOtp = async (dto: RequestOtpDto): Promise<OtpResponse> => {
    const response = await api.post<OtpResponse>('/auth/request-otp', dto);
    return response.data;
};

/**
 * Verify OTP yang dikirim ke email
 */
export const verifyOtp = async (dto: VerifyOtpDto): Promise<OtpResponse> => {
    const response = await api.post<OtpResponse>('/auth/verify-otp', dto);
    return response.data;
};

/**
 * Register user dengan email yang sudah diverifikasi
 */
export const register = async (
    dto: RegisterDto,
): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', dto);
    return response.data;
};

/**
 * Login user
 */
export const login = async (dto: LoginDto): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', dto);
    return response.data;
};

/**
 * Logout user (clear token from localStorage)
 */
export const logout = (): void => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
};

/**
 * Get stored token
 */
export const getToken = (): string | null => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('token');
    }
    return null;
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
    if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
    }
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
    if (dto.birthPlace) {
        formData.append('birthPlace', dto.birthPlace);
    }
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

export const getSignatureStatus = async (): Promise<SignatureStatusResponse> => {
    const response = await api.get<SignatureStatusResponse>('/certification/signature/me');
    return response.data;
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

export const listAssignedCertificationDocuments = async (): Promise<AssignedDocumentsResponse> => {
    const response = await api.get<AssignedDocumentsResponse>('/certification/documents/assigned');
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
