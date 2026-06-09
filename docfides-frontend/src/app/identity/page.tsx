'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function IdentityRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/profile');
    }, [router]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-medium text-slate-600">
            Membuka halaman profil...
        </div>
    );
}
