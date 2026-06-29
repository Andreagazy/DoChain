import { AxiosError } from 'axios';

export type ApiError = {
    message?: string | string[];
};

export type CertificationStepKey = 'upload' | 'signers' | 'placeholders' | 'review';

export type PlaceholderConfig = {
    visiblePage: number;
    visibleX: number;
    visibleY: number;
    visibleWidth: number;
    visibleHeight: number;
};

export type PdfViewport = {
    width: number;
    height: number;
};

export type PdfRenderTask = {
    promise: Promise<void>;
    cancel: () => void;
};

export type PdfPageProxy = {
    getViewport: (options: { scale: number }) => PdfViewport;
    render: (options: {
        canvasContext: CanvasRenderingContext2D;
        canvas: HTMLCanvasElement;
        viewport: PdfViewport;
    }) => PdfRenderTask;
    cleanup?: () => void;
};

export type PdfDocumentProxy = {
    numPages: number;
    getPage: (pageNumber: number) => Promise<PdfPageProxy>;
    destroy?: () => void;
};

type PdfJsModule = {
    getDocument: (options: {
        data: Uint8Array;
        disableWorker?: boolean;
    }) => {
        promise: Promise<PdfDocumentProxy>;
    };
    GlobalWorkerOptions?: {
        workerSrc?: string;
    };
};

let cachedPdfJsModule: PdfJsModule | null = null;

export async function loadPdfJsModule(): Promise<PdfJsModule> {
    if (cachedPdfJsModule) {
        return cachedPdfJsModule;
    }

    try {
        const pdfModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const pdfModuleLoaded = pdfModule as PdfJsModule & { GlobalWorkerOptions: { workerSrc: string } };

        if (pdfModuleLoaded.GlobalWorkerOptions) {
            pdfModuleLoaded.GlobalWorkerOptions.workerSrc = new URL(
                'pdfjs-dist/legacy/build/pdf.worker.mjs',
                import.meta.url,
            ).href;
        }

        cachedPdfJsModule = pdfModuleLoaded;
        return cachedPdfJsModule;
    } catch {
        const fallbackModule = await import('pdfjs-dist/build/pdf.mjs');
        const pdfModuleLoaded = fallbackModule as PdfJsModule & { GlobalWorkerOptions: { workerSrc: string } };

        if (pdfModuleLoaded.GlobalWorkerOptions) {
            pdfModuleLoaded.GlobalWorkerOptions.workerSrc = new URL(
                'pdfjs-dist/build/pdf.worker.mjs',
                import.meta.url,
            ).href;
        }

        cachedPdfJsModule = pdfModuleLoaded;
        return cachedPdfJsModule;
    }
}

export function normalizeErrorMessage(err: unknown): string {
    const axiosError = err as AxiosError<ApiError>;
    const message = axiosError.response?.data?.message;
    return Array.isArray(message)
        ? message.join(', ')
        : message ?? axiosError.message ?? 'Terjadi kesalahan';
}

export function getDefaultPlaceholder(index: number): PlaceholderConfig {
    return {
        visiblePage: 1,
        visibleX: 36,
        visibleY: 36 + index * 80,
        visibleWidth: 160,
        visibleHeight: 70,
    };
}

export function buildCertificationStepHref(step: CertificationStepKey, documentId?: string): string {
    const basePath = `/certification/${step === 'upload' ? 'upload' : step}`;
    return basePath;
}

const ACTIVE_CERTIFICATION_DOCUMENT_KEY = 'docchain.activeCertificationDocumentId';

export function setActiveCertificationDocumentId(documentId: string) {
    if (typeof window === 'undefined' || !documentId) return;
    window.sessionStorage.setItem(ACTIVE_CERTIFICATION_DOCUMENT_KEY, documentId);
}

export function getActiveCertificationDocumentId() {
    if (typeof window === 'undefined') return '';
    return window.sessionStorage.getItem(ACTIVE_CERTIFICATION_DOCUMENT_KEY) ?? '';
}

export function clearActiveCertificationDocumentId() {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(ACTIVE_CERTIFICATION_DOCUMENT_KEY);
}

export function getDocumentNextCertificationStep(status: string, requiredSignerCount?: number): CertificationStepKey {
    const normalizedStatus = status.toUpperCase();

    if (normalizedStatus.includes('DRAFT') || requiredSignerCount === 0) {
        return 'signers';
    }

    if (
        normalizedStatus.includes('PLACEHOLDER') ||
        normalizedStatus.includes('PENDING') ||
        normalizedStatus.includes('PARTIALLY')
    ) {
        return 'review';
    }

    return 'review';
}

export function getCertificationStepIndex(step: CertificationStepKey): number {
    switch (step) {
        case 'upload':
            return 0;
        case 'signers':
            return 1;
        case 'placeholders':
            return 2;
        case 'review':
            return 3;
    }
}
