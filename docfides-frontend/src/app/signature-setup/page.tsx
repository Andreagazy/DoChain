'use client';

import { Suspense, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { AxiosError } from 'axios';
import { AlertCircle, CheckCircle2, Loader2, PenLine } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getIdentityStatus, getSignatureStatus, updateSignaturePreference, uploadSignatureImage } from '@/lib/auth-service';

type ApiError = {
    message?: string | string[];
};

type CropRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type CropInteraction = 'move' | 'resize' | null;

const SIGNATURE_PLACEHOLDER_ASPECT_RATIO = 160 / 70;
const SIGNATURE_CROP_SCALE = 0.7;
const MIN_CROP_WIDTH = Math.ceil(SIGNATURE_PLACEHOLDER_ASPECT_RATIO);

function normalizeErrorMessage(err: unknown): string {
    const axiosError = err as AxiosError<ApiError>;
    const message = axiosError.response?.data?.message;
    return Array.isArray(message)
        ? message.join(', ')
        : message ?? axiosError.message ?? 'Terjadi kesalahan';
}

function SignatureSetupContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [identityApproved, setIdentityApproved] = useState(false);
    const [mode, setMode] = useState<'invisible' | 'visible'>('invisible');
    const [signatureFile, setSignatureFile] = useState<File | null>(null);
    const [signaturePreviewUrl, setSignaturePreviewUrl] = useState('');
    const [signatureImage, setSignatureImage] = useState<{ width: number; height: number } | null>(null);
    const [cropRect, setCropRect] = useState<CropRect | null>(null);
    const [cropInteraction, setCropInteraction] = useState<CropInteraction>(null);
    const [hasSignature, setHasSignature] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const previewContainerRef = useRef<HTMLDivElement | null>(null);

    const buildCropRect = (image: { width: number; height: number }, scale: number): CropRect => {
        const maxWidthByHeight = image.height * SIGNATURE_PLACEHOLDER_ASPECT_RATIO;
        const maxWidth = Math.min(image.width, maxWidthByHeight);
        const width = Math.max(1, Math.round(maxWidth * scale));
        const height = Math.max(1, Math.round(width / SIGNATURE_PLACEHOLDER_ASPECT_RATIO));

        return {
            x: Math.round((image.width - width) / 2),
            y: Math.round((image.height - height) / 2),
            width,
            height,
        };
    };

    const defaultCropRect = useMemo(() => {
        if (!signatureImage) {
            return null;
        }

        return buildCropRect(signatureImage, SIGNATURE_CROP_SCALE);
    }, [signatureImage]);

    useEffect(() => {
        async function loadStatus() {
            try {
                const [identityStatus, signatureStatus] = await Promise.all([
                    getIdentityStatus(),
                    getSignatureStatus(),
                ]);

                setIdentityApproved(identityStatus.status === 'APPROVED');
                setHasSignature(signatureStatus.hasSignature);
                setMode(signatureStatus.preferredSignatureMode);
            } catch (err) {
                setError(normalizeErrorMessage(err));
            } finally {
                setLoading(false);
            }
        }

        void loadStatus();
    }, []);

    const nextPath = useMemo(() => searchParams.get('next') ?? '/certification', [searchParams]);

    useEffect(() => {
        return () => {
            if (signaturePreviewUrl) {
                URL.revokeObjectURL(signaturePreviewUrl);
            }
        };
    }, [signaturePreviewUrl]);

    useEffect(() => {
        if (!signatureFile) {
            setSignaturePreviewUrl('');
            setSignatureImage(null);
            setCropRect(null);
            return;
        }

        let cancelled = false;
        const objectUrl = URL.createObjectURL(signatureFile);
        setSignaturePreviewUrl(objectUrl);

        const image = new globalThis.Image();
        image.onload = () => {
            if (cancelled) {
                URL.revokeObjectURL(objectUrl);
                return;
            }

            const nextImage = { width: image.naturalWidth, height: image.naturalHeight };
            setSignatureImage(nextImage);
            setCropRect((current) => current ?? buildCropRect(nextImage, SIGNATURE_CROP_SCALE));
        };
        image.src = objectUrl;

        return () => {
            cancelled = true;
            URL.revokeObjectURL(objectUrl);
        };
    }, [signatureFile]);

    const renderCropRect = cropRect ?? defaultCropRect;

    const clampCropRect = (rect: CropRect, image: { width: number; height: number }): CropRect => {
        const width = Math.max(1, Math.min(rect.width, image.width));
        const height = Math.max(1, Math.min(rect.height, image.height));
        const x = Math.max(0, Math.min(rect.x, image.width - width));
        const y = Math.max(0, Math.min(rect.y, image.height - height));

        return { x, y, width, height };
    };

    const resizeCropRect = (
        rect: CropRect,
        deltaX: number,
        deltaY: number,
        image: { width: number; height: number },
    ): CropRect => {
        const resizeVectorY = 1 / SIGNATURE_PLACEHOLDER_ASPECT_RATIO;
        const projectedDelta = (deltaX + deltaY * resizeVectorY) / (1 + resizeVectorY * resizeVectorY);
        const maxWidth = Math.min(
            image.width - rect.x,
            Math.floor((image.height - rect.y) * SIGNATURE_PLACEHOLDER_ASPECT_RATIO),
        );
        const nextWidth = Math.max(MIN_CROP_WIDTH, Math.min(Math.round(rect.width + projectedDelta), maxWidth));
        const nextHeight = Math.max(1, Math.round(nextWidth / SIGNATURE_PLACEHOLDER_ASPECT_RATIO));

        return clampCropRect({ x: rect.x, y: rect.y, width: nextWidth, height: nextHeight }, image);
    };

    const toImageCoords = (event: MouseEvent<HTMLElement>) => {
        if (!previewContainerRef.current || !signatureImage) {
            return null;
        }

        const rect = previewContainerRef.current.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * signatureImage.width;
        const y = ((event.clientY - rect.top) / rect.height) * signatureImage.height;

        return {
            x: Math.max(0, Math.min(signatureImage.width, x)),
            y: Math.max(0, Math.min(signatureImage.height, y)),
        };
    };

    const handleCropPointerDown = (event: MouseEvent<HTMLDivElement>) => {
        if (!signatureImage) {
            return;
        }

        const point = toImageCoords(event);
        if (!point) {
            return;
        }

        const startingRect = renderCropRect ?? {
            ...buildCropRect(signatureImage, SIGNATURE_CROP_SCALE),
        };

        const offsetX = point.x - startingRect.x;
        const offsetY = point.y - startingRect.y;

        const moveHandler = (moveEvent: globalThis.MouseEvent) => {
            if (!previewContainerRef.current || !signatureImage) {
                return;
            }

            const containerRect = previewContainerRef.current.getBoundingClientRect();
            const nextX = ((moveEvent.clientX - containerRect.left) / containerRect.width) * signatureImage.width - offsetX;
            const nextY = ((moveEvent.clientY - containerRect.top) / containerRect.height) * signatureImage.height - offsetY;

            setCropRect(clampCropRect({ ...startingRect, x: Math.round(nextX), y: Math.round(nextY) }, signatureImage));
        };

        const upHandler = () => {
            setCropInteraction(null);
            window.removeEventListener('mousemove', moveHandler);
            window.removeEventListener('mouseup', upHandler);
        };

        setCropInteraction('move');
        window.addEventListener('mousemove', moveHandler);
        window.addEventListener('mouseup', upHandler);
    };

    const handleCropResizePointerDown = (event: MouseEvent<HTMLElement>) => {
        if (!signatureImage || !renderCropRect) {
            return;
        }

        event.stopPropagation();

        const startingRect = renderCropRect;
        const startPoint = toImageCoords(event);
        if (!startPoint) {
            return;
        }

        const moveHandler = (moveEvent: globalThis.MouseEvent) => {
            if (!previewContainerRef.current || !signatureImage) {
                return;
            }

            const containerRect = previewContainerRef.current.getBoundingClientRect();
            const currentPointX = ((moveEvent.clientX - containerRect.left) / containerRect.width) * signatureImage.width;
            const currentPointY = ((moveEvent.clientY - containerRect.top) / containerRect.height) * signatureImage.height;

            const nextRect = resizeCropRect(
                startingRect,
                currentPointX - startPoint.x,
                currentPointY - startPoint.y,
                signatureImage,
            );

            setCropRect(nextRect);
        };

        const upHandler = () => {
            setCropInteraction(null);
            window.removeEventListener('mousemove', moveHandler);
            window.removeEventListener('mouseup', upHandler);
        };

        setCropInteraction('resize');
        window.addEventListener('mousemove', moveHandler);
        window.addEventListener('mouseup', upHandler);
    };

    const handleResetCrop = () => {
        setCropRect(defaultCropRect);
    };

    const handleUseFullImage = () => {
        if (!signatureImage) {
            return;
        }

        setCropRect(buildCropRect(signatureImage, 1));
    };

    const cropCursor = cropInteraction === 'resize'
        ? 'se-resize'
        : cropInteraction === 'move'
            ? 'grabbing'
            : 'grab';

    const createCroppedSignatureBlob = async () => {
        if (!signatureFile || !signaturePreviewUrl || !signatureImage) {
            return signatureFile;
        }

        const sourceImage = new globalThis.Image();
        sourceImage.src = signaturePreviewUrl;
        await new Promise<void>((resolve, reject) => {
            sourceImage.onload = () => resolve();
            sourceImage.onerror = () => reject(new Error('Gagal memuat gambar tanda tangan'));
        });

        const rect = clampCropRect(cropRect ?? defaultCropRect ?? {
            x: 0,
            y: 0,
            width: signatureImage.width,
            height: signatureImage.height,
        }, signatureImage);

        const canvas = document.createElement('canvas');
        canvas.width = rect.width;
        canvas.height = rect.height;

        const context = canvas.getContext('2d');
        if (!context) {
            return signatureFile;
        }

        context.drawImage(
            sourceImage,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            0,
            0,
            rect.width,
            rect.height,
        );

        const mimeType = signatureFile.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((nextBlob) => resolve(nextBlob), mimeType, mimeType === 'image/jpeg' ? 0.95 : undefined);
        });

        if (!blob) {
            return signatureFile;
        }

        return new File([blob], signatureFile.name.replace(/\.(png|jpe?g)$/i, mimeType === 'image/png' ? '.png' : '.jpg'), {
            type: mimeType,
        });
    };

    const handleSave = async () => {
        setError('');
        setSuccess('');

        if (!identityApproved) {
            setError('Identitas harus APPROVED sebelum setup tanda tangan.');
            return;
        }

        if (mode === 'visible' && !hasSignature && !signatureFile) {
            setError('Untuk mode visible, upload gambar tanda tangan terlebih dahulu.');
            return;
        }

        setSaving(true);
        try {
            if (mode === 'visible' && signatureFile) {
                const croppedFile = await createCroppedSignatureBlob();
                if (croppedFile) {
                    await uploadSignatureImage(croppedFile);
                }
                setHasSignature(true);
            }

            await updateSignaturePreference(mode);

            setSuccess('Setup tanda tangan berhasil disimpan.');
            router.push(nextPath);
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center">
                <div className="flex items-center gap-2 text-slate-600">
                    <Loader2 className="animate-spin" />
                    <span>Memuat setup tanda tangan...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-slate-100 text-slate-900">
            <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold">Setup Tanda Tangan</h1>
                        <p className="text-sm text-slate-600 mt-1">Pilih mode default sebelum masuk ke proses sertifikasi dokumen.</p>
                    </div>
                    <Button variant="outline" className="border-slate-300" onClick={() => router.push('/dashboard')}>
                        Dashboard
                    </Button>
                </div>

                {error && (
                    <Alert className="border-red-200 bg-red-50 text-red-800">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {success && (
                    <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertDescription>{success}</AlertDescription>
                    </Alert>
                )}

                {!identityApproved && (
                    <Card className="border-amber-200 bg-amber-50">
                        <CardHeader>
                            <CardTitle className="text-amber-900">Identitas Belum APPROVED</CardTitle>
                            <CardDescription className="text-amber-800">
                                Anda perlu menyelesaikan verifikasi identitas terlebih dahulu.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={() => router.push('/identity')}>Ke Verifikasi Identitas</Button>
                        </CardContent>
                    </Card>
                )}

                <Card className="border-slate-200 bg-white/90 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><PenLine className="h-5 w-5" /> Pilihan Mode</CardTitle>
                        <CardDescription>
                            Invisible: langsung sign tanpa gambar. Visible: wajib punya gambar tanda tangan.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setMode('invisible')}
                                className={`rounded-lg border px-4 py-3 text-left ${mode === 'invisible' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}
                            >
                                <p className="font-semibold text-slate-900">Invisible Signature</p>
                                <p className="text-xs text-slate-600 mt-1">Tidak perlu upload gambar tanda tangan.</p>
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('visible')}
                                className={`rounded-lg border px-4 py-3 text-left ${mode === 'visible' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}
                            >
                                <p className="font-semibold text-slate-900">Visible Signature</p>
                                <p className="text-xs text-slate-600 mt-1">Gunakan gambar tanda tangan di PDF.</p>
                            </button>
                        </div>

                        {mode === 'visible' && (
                            <div className="space-y-2">
                                <label className="text-sm text-slate-700">Upload tanda tangan (png/jpg)</label>
                                <Input
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg"
                                    onChange={(event) => setSignatureFile(event.target.files?.[0] ?? null)}
                                />
                                {hasSignature && !signatureFile && (
                                    <p className="text-xs text-emerald-700">Tanda tangan tersimpan sudah ada, Anda bisa langsung lanjut.</p>
                                )}

                                {signaturePreviewUrl && signatureImage && renderCropRect && (
                                    <div className="space-y-3 pt-2">
                                        <div className="flex flex-wrap gap-2">
                                            <Button type="button" variant="outline" className="border-slate-300" onClick={handleResetCrop}>
                                                Reset Crop
                                            </Button>
                                            <Button type="button" variant="outline" className="border-slate-300" onClick={handleUseFullImage}>
                                                Pakai Seluruh Gambar
                                            </Button>
                                        </div>

                                        <div
                                            ref={previewContainerRef}
                                            className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                                            style={{ aspectRatio: `${signatureImage.width} / ${signatureImage.height}` }}
                                            onMouseDown={handleCropPointerDown}
                                        >
                                            <Image
                                                src={signaturePreviewUrl}
                                                alt="Preview tanda tangan"
                                                fill
                                                unoptimized
                                                className="select-none object-contain"
                                                draggable={false}
                                                sizes="(max-width: 768px) 100vw, 768px"
                                            />
                                            {renderCropRect && (
                                                <div
                                                    className="absolute border-2 border-blue-600 bg-blue-600/10"
                                                    style={{
                                                        left: `${(renderCropRect.x / signatureImage.width) * 100}%`,
                                                        top: `${(renderCropRect.y / signatureImage.height) * 100}%`,
                                                        width: `${(renderCropRect.width / signatureImage.width) * 100}%`,
                                                        height: `${(renderCropRect.height / signatureImage.height) * 100}%`,
                                                        cursor: cropCursor,
                                                    }}
                                                >
                                                    <span className="absolute -top-5 left-0 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">
                                                        Crop Area
                                                    </span>
                                                    <button
                                                        type="button"
                                                        aria-label="Resize crop area"
                                                        className="absolute -bottom-2 -right-2 h-4 w-4 rounded border-2 border-white bg-blue-600 shadow-sm"
                                                        onMouseDown={handleCropResizePointerDown}
                                                        style={{ cursor: cropCursor }}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-xs text-slate-600">
                                            Geser area biru untuk memindahkan crop, atau tarik kotak kecil di sudut kanan-bawah untuk memperbesar/perkecil. Rasio crop tetap dikunci agar cocok dengan placeholder signature di PDF.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        <Button disabled={saving || !identityApproved} onClick={handleSave}>
                            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Simpan & Lanjutkan
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function SignatureSetupPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-slate-100" />}>
            <SignatureSetupContent />
        </Suspense>
    );
}
