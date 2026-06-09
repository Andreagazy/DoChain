'use client';

import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { AxiosError } from 'axios';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, PenLine, RotateCcw, Save, UploadCloud } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getIdentityStatus, getSignatureImageFile, getSignatureStatus, updateSignaturePreference, uploadSignatureImage } from '@/lib/auth-service';

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
    const [storedSignaturePreviewUrl, setStoredSignaturePreviewUrl] = useState('');
    const [storedSignatureImage, setStoredSignatureImage] = useState<{ width: number; height: number } | null>(null);
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

                if (signatureStatus.hasSignature) {
                    try {
                        const signatureBlob = await getSignatureImageFile();
                        const objectUrl = URL.createObjectURL(signatureBlob);
                        setStoredSignaturePreviewUrl(objectUrl);

                        const image = new globalThis.Image();
                        image.onload = () => {
                            setStoredSignatureImage({
                                width: image.naturalWidth,
                                height: image.naturalHeight,
                            });
                        };
                        image.onerror = () => setStoredSignatureImage(null);
                        image.src = objectUrl;
                    } catch {
                        setStoredSignaturePreviewUrl('');
                        setStoredSignatureImage(null);
                    }
                }
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
        return () => {
            if (storedSignaturePreviewUrl) {
                URL.revokeObjectURL(storedSignaturePreviewUrl);
            }
        };
    }, [storedSignaturePreviewUrl]);

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

    const cropPreviewStyle = useMemo<CSSProperties | null>(() => {
        if (!signaturePreviewUrl || !signatureImage || !renderCropRect) {
            return null;
        }

        const previewScale = Math.min(1, 360 / renderCropRect.width);
        const width = Math.max(48, Math.round(renderCropRect.width * previewScale));
        const height = Math.max(21, Math.round(renderCropRect.height * previewScale));

        return {
            width,
            height,
            backgroundImage: `url(${signaturePreviewUrl})`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${signatureImage.width * previewScale}px ${signatureImage.height * previewScale}px`,
            backgroundPosition: `${-renderCropRect.x * previewScale}px ${-renderCropRect.y * previewScale}px`,
        };
    }, [renderCropRect, signatureImage, signaturePreviewUrl]);

    const storedSignaturePreviewStyle = useMemo<CSSProperties | null>(() => {
        if (!storedSignaturePreviewUrl || !storedSignatureImage) {
            return null;
        }

        const previewScale = Math.min(1, 360 / storedSignatureImage.width);
        const width = Math.max(48, Math.round(storedSignatureImage.width * previewScale));
        const height = Math.max(21, Math.round(storedSignatureImage.height * previewScale));

        return {
            width,
            height,
            backgroundImage: `url(${storedSignaturePreviewUrl})`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${width}px ${height}px`,
            backgroundPosition: 'center',
        };
    }, [storedSignatureImage, storedSignaturePreviewUrl]);

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
        const containerRect = previewContainerRef.current?.getBoundingClientRect();
        let pendingRect: CropRect | null = null;
        let animationFrame: number | null = null;

        const scheduleCropRectUpdate = (nextRect: CropRect) => {
            pendingRect = nextRect;

            if (animationFrame !== null) {
                return;
            }

            animationFrame = window.requestAnimationFrame(() => {
                if (pendingRect) {
                    setCropRect(pendingRect);
                }
                pendingRect = null;
                animationFrame = null;
            });
        };

        const moveHandler = (moveEvent: globalThis.MouseEvent) => {
            if (!containerRect || !signatureImage) {
                return;
            }

            const nextX = ((moveEvent.clientX - containerRect.left) / containerRect.width) * signatureImage.width - offsetX;
            const nextY = ((moveEvent.clientY - containerRect.top) / containerRect.height) * signatureImage.height - offsetY;

            scheduleCropRectUpdate(clampCropRect({ ...startingRect, x: Math.round(nextX), y: Math.round(nextY) }, signatureImage));
        };

        const upHandler = () => {
            if (animationFrame !== null) {
                window.cancelAnimationFrame(animationFrame);
            }
            if (pendingRect) {
                setCropRect(pendingRect);
            }
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
        const containerRect = previewContainerRef.current?.getBoundingClientRect();
        let pendingRect: CropRect | null = null;
        let animationFrame: number | null = null;

        const scheduleCropRectUpdate = (nextRect: CropRect) => {
            pendingRect = nextRect;

            if (animationFrame !== null) {
                return;
            }

            animationFrame = window.requestAnimationFrame(() => {
                if (pendingRect) {
                    setCropRect(pendingRect);
                }
                pendingRect = null;
                animationFrame = null;
            });
        };

        const moveHandler = (moveEvent: globalThis.MouseEvent) => {
            if (!containerRect || !signatureImage) {
                return;
            }

            const currentPointX = ((moveEvent.clientX - containerRect.left) / containerRect.width) * signatureImage.width;
            const currentPointY = ((moveEvent.clientY - containerRect.top) / containerRect.height) * signatureImage.height;

            const nextRect = resizeCropRect(
                startingRect,
                currentPointX - startPoint.x,
                currentPointY - startPoint.y,
                signatureImage,
            );

            scheduleCropRectUpdate(nextRect);
        };

        const upHandler = () => {
            if (animationFrame !== null) {
                window.cancelAnimationFrame(animationFrame);
            }
            if (pendingRect) {
                setCropRect(pendingRect);
            }
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
            <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9]">
                <div className="flex items-center gap-2 text-slate-600">
                    <Loader2 className="animate-spin" />
                    <span>Memuat setup tanda tangan...</span>
                </div>
            </div>
        );
    }

    return (
        <AppShell title="Signature Setup" subtitle="Atur mode tanda tangan default untuk proses sertifikasi.">
            <div className="space-y-6">
                <section className="rounded-lg border border-blue-100 bg-white p-6 shadow-sm md:p-8">
                        <Badge variant={identityApproved ? 'success' : 'warning'}>
                            {identityApproved ? 'Identity Approved' : 'Identity Required'}
                        </Badge>
                        <h1 className="mt-4 text-2xl font-semibold text-slate-950 md:text-3xl">Setup tanda tangan digital</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                            Pilih invisible signature untuk signing tanpa gambar, atau visible signature jika tanda tangan perlu tampil pada PDF final.
                        </p>
                </section>

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
                    <Card className="rounded-lg border-amber-200 bg-amber-50 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-amber-900">Identitas Belum APPROVED</CardTitle>
                            <CardDescription className="text-amber-800">
                                Anda perlu menyelesaikan verifikasi identitas terlebih dahulu.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={() => router.push('/profile#identitas-ktp')}>Ke Verifikasi Identitas</Button>
                        </CardContent>
                    </Card>
                )}

                <Card className="rounded-lg border-blue-100 bg-white shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><PenLine className="h-5 w-5" /> Pilihan Mode</CardTitle>
                        <CardDescription>
                            Invisible: langsung sign tanpa gambar. Visible: wajib punya gambar tanda tangan.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => setMode('invisible')}
                                className={`rounded-lg border px-4 py-4 text-left transition ${mode === 'invisible' ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-blue-200'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <EyeOff className="h-4 w-4 text-blue-700" />
                                    <p className="font-semibold text-slate-950">Invisible Signature</p>
                                </div>
                                <p className="text-xs text-slate-600 mt-1">Tidak perlu upload gambar tanda tangan.</p>
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('visible')}
                                className={`rounded-lg border px-4 py-4 text-left transition ${mode === 'visible' ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-blue-200'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Eye className="h-4 w-4 text-blue-700" />
                                    <p className="font-semibold text-slate-950">Visible Signature</p>
                                </div>
                                <p className="text-xs text-slate-600 mt-1">Gunakan gambar tanda tangan di PDF.</p>
                            </button>
                        </div>

                        {mode === 'visible' && (
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                    <UploadCloud className="h-4 w-4" />
                                    Upload tanda tangan (png/jpg)
                                </label>
                                <Input
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg"
                                    onChange={(event) => setSignatureFile(event.target.files?.[0] ?? null)}
                                />
                                {hasSignature && !signatureFile && (
                                    <p className="text-xs text-emerald-700">Tanda tangan tersimpan sudah ada, Anda bisa langsung lanjut.</p>
                                )}

                                {hasSignature && storedSignaturePreviewUrl && !signatureFile && (
                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-emerald-950">Preview tanda tangan tersimpan</p>
                                                <p className="mt-1 text-xs text-emerald-800">
                                                    Ini adalah gambar tanda tangan visible yang sedang aktif. Upload file baru jika ingin menggantinya.
                                                </p>
                                            </div>
                                            <Badge variant="success">Aktif</Badge>
                                        </div>
                                        <div className="mt-4 overflow-auto rounded-lg border border-emerald-100 bg-white p-4">
                                            {storedSignaturePreviewStyle ? (
                                                <div
                                                    aria-label="Preview tanda tangan tersimpan"
                                                    className="mx-auto rounded border border-slate-200 bg-white shadow-sm"
                                                    style={storedSignaturePreviewStyle}
                                                />
                                            ) : (
                                                <div className="flex h-24 items-center justify-center gap-2 text-sm text-slate-500">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Memuat preview tanda tangan...
                                                </div>
                                            )}
                                            {storedSignatureImage && (
                                                <p className="mt-3 text-center text-xs text-slate-500">
                                                    Ukuran tersimpan: {storedSignatureImage.width} x {storedSignatureImage.height}px
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {signaturePreviewUrl && signatureImage && renderCropRect && (
                                    <div className="space-y-3 pt-2">
                                        <div className="flex flex-wrap gap-2">
                                            <Button type="button" variant="outline" className="border-slate-300" onClick={handleResetCrop}>
                                                <RotateCcw className="h-4 w-4" />
                                                Reset Crop
                                            </Button>
                                            <Button type="button" variant="outline" className="border-slate-300" onClick={handleUseFullImage}>
                                                Pakai Seluruh Gambar
                                            </Button>
                                        </div>

                                        <div
                                            ref={previewContainerRef}
                                            className="relative w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
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
                                                        willChange: 'left, top, width, height',
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

                                        {cropPreviewStyle && (
                                            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                                                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-950">Preview hasil crop</p>
                                                        <p className="text-xs text-slate-600">
                                                            Tampilan ini mengikuti area biru yang akan disimpan sebagai tanda tangan.
                                                        </p>
                                                    </div>
                                                    <Badge variant="neutral">
                                                        {renderCropRect.width} x {renderCropRect.height}px
                                                    </Badge>
                                                </div>
                                                <div className="mt-4 overflow-auto rounded-lg border border-blue-100 bg-white p-4">
                                                    <div
                                                        aria-label="Preview hasil crop tanda tangan"
                                                        className="mx-auto rounded border border-slate-200 bg-white shadow-sm"
                                                        style={cropPreviewStyle}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <Button disabled={saving || !identityApproved} onClick={handleSave}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Simpan & Lanjutkan
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </AppShell>
    );
}

export default function SignatureSetupPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-slate-100" />}>
            <SignatureSetupContent />
        </Suspense>
    );
}
