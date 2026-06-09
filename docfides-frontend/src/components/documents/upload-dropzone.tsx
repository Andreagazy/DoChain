'use client';

import { FileText, UploadCloud, X } from 'lucide-react';

interface UploadDropzoneProps {
    file: File | null;
    onFileSelect: (file: File | null) => void;
}

export function UploadDropzone({ file, onFileSelect }: UploadDropzoneProps) {
    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const droppedFile = event.dataTransfer.files?.[0];
        if (droppedFile && droppedFile.type === 'application/pdf') {
            onFileSelect(droppedFile);
        }
    };

    return (
        <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            className="w-full rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 p-4 text-center"
        >
            <label className="block cursor-pointer rounded-xl border border-blue-100 bg-white p-5 transition hover:border-blue-200 hover:bg-blue-50/40">
                <input
                    aria-label="Upload PDF"
                    type="file"
                    accept="application/pdf"
                    className="sr-only"
                    onChange={(event) => onFileSelect(event.target.files?.[0] ?? null)}
                />
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                    <UploadCloud className="h-6 w-6" />
                </span>
                <span className="mt-4 block text-sm font-semibold text-slate-900">
                    Drag & drop PDF atau klik untuk memilih
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                    Maksimum 20 MB, format PDF.
                </span>
                <span className="mt-4 inline-flex rounded-xl border border-blue-200 bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm">
                    Pilih File PDF
                </span>
            </label>

            {file ? (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white p-3 text-left">
                    <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                            <FileText className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{file.name}</p>
                            <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => onFileSelect(null)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                        aria-label="Hapus file"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ) : null}
        </div>
    );
}
