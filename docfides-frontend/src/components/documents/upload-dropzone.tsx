'use client';

import { UploadCloud } from 'lucide-react';

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
            className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center"
        >
            <UploadCloud className="mx-auto h-10 w-10 text-slate-500" />
            <p className="mt-3 text-sm text-slate-700">Drag and drop PDF di sini, atau klik untuk memilih file.</p>
            <p className="mt-1 text-xs text-slate-500">Maksimum 20 MB, format PDF.</p>

            <input
                aria-label="Upload PDF"
                type="file"
                accept="application/pdf"
                className="mt-4 block w-full cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                onChange={(event) => onFileSelect(event.target.files?.[0] ?? null)}
            />

            {file ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-left">
                    <p className="text-sm font-medium text-slate-900">Selected file</p>
                    <p className="text-sm text-slate-600">{file.name}</p>
                    <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
            ) : null}
        </div>
    );
}
