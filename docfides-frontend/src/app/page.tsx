'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { getDefaultHomePath, getToken, getUser } from '@/lib/auth-service';

export default function HomePage() {
    const router = useRouter();

    useEffect(() => {
        const token = getToken();
        if (token) {
            router.replace(getDefaultHomePath(getUser()));
            return;
        }

        router.replace('/login');
    }, [router]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
            <div className="flex items-center gap-2 text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Preparing workspace...</span>
            </div>
        </div>
    );
}
