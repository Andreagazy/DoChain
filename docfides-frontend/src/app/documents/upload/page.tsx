'use client';

import { useState } from 'react';
import { AxiosError } from 'axios';
import api from '@/lib/axios';
import { AppShell } from '@/components/layout/app-shell';
import { UploadDropzone } from '@/components/documents/upload-dropzone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

function normalizeErrorMessage(err: unknown): string {
    const axiosError = err as AxiosError<{ message?: string | string[] }>;
    const message = axiosError.response?.data?.message;
    return Array.isArray(message) ? message.join(', ') : message ?? axiosError.message ?? 'Terjadi kesalahan';
}

export default function UploadDocumentPage() {
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleUpload = async () => {
        setError('');
        setSuccess('');

        if (!file) {
            setError('Please select a PDF file before uploading.');
            return;
        }

        if (!title.trim()) {
            setError('Document title is required.');
            return;
        }

        const formData = new FormData();
        formData.append('documentFile', file);

        setUploading(true);
        setProgress(5);

        try {
            await api.post('/certification/documents/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                onUploadProgress: (event) => {
                    if (!event.total) {
                        return;
                    }
                    const nextProgress = Math.round((event.loaded / event.total) * 100);
                    setProgress(nextProgress);
                },
            });

            setProgress(100);
            setSuccess('Document uploaded successfully and ready for certification.');
            setFile(null);
            setTitle('');
            setDescription('');
        } catch (err) {
            setError(normalizeErrorMessage(err));
        } finally {
            setUploading(false);
        }
    };

    return (
        <AppShell title="Upload Document" subtitle="Drag, preview, and upload documents with metadata.">
            <div className="space-y-6">
                {error ? (
                    <Alert className="border-red-200 bg-red-50 text-red-800">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}

                {success ? (
                    <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                        <AlertDescription>{success}</AlertDescription>
                    </Alert>
                ) : null}

                <Card className="border-slate-200 bg-white/90 shadow-sm">
                    <CardHeader>
                        <CardTitle>Upload Area</CardTitle>
                        <CardDescription>Use drag-and-drop or choose file manually.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <UploadDropzone file={file} onFileSelect={setFile} />
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white/90 shadow-sm">
                    <CardHeader>
                        <CardTitle>Document Metadata</CardTitle>
                        <CardDescription>Add contextual info to help tracking and audit readability.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-sm text-slate-700" htmlFor="doc-title">Title</label>
                            <Input
                                id="doc-title"
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                placeholder="Procurement Agreement Q2"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm text-slate-700" htmlFor="doc-description">Description</label>
                            <textarea
                                id="doc-description"
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                className="min-h-[110px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                placeholder="Add details, participants, or verification notes"
                            />
                        </div>

                        {uploading ? (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs text-slate-600">
                                    <span>Uploading...</span>
                                    <span>{progress}%</span>
                                </div>
                                <Progress value={progress} />
                            </div>
                        ) : null}

                        <Button onClick={handleUpload} disabled={uploading}>
                            {uploading ? 'Uploading...' : 'Upload Document'}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </AppShell>
    );
}
