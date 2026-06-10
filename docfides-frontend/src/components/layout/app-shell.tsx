'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppTopbar } from '@/components/layout/app-topbar';
import {
    clearAuthSession,
    getStoredToken,
    isAuthSessionIdleExpired,
    recordAuthActivity,
} from '@/lib/auth-session';

interface AppShellProps {
    title: string;
    subtitle?: string;
    children: ReactNode;
}

export function AppShell({ title, subtitle, children }: AppShellProps) {
    const router = useRouter();
    const lastActivityWriteRef = useRef(0);

    useEffect(() => {
        const expireSession = () => {
            clearAuthSession();
            router.replace('/login?reason=session-expired');
        };

        const checkIdleTimeout = () => {
            if (isAuthSessionIdleExpired()) {
                expireSession();
            }
        };

        const handleActivity = () => {
            if (!getStoredToken()) {
                return;
            }

            if (isAuthSessionIdleExpired()) {
                expireSession();
                return;
            }

            const now = Date.now();
            if (now - lastActivityWriteRef.current > 30_000) {
                recordAuthActivity();
                lastActivityWriteRef.current = now;
            }
        };

        const activityEvents: Array<keyof WindowEventMap> = [
            'click',
            'keydown',
            'mousemove',
            'scroll',
            'touchstart',
        ];

        activityEvents.forEach((eventName) => {
            window.addEventListener(eventName, handleActivity, { passive: true });
        });
        window.addEventListener('focus', checkIdleTimeout);
        document.addEventListener('visibilitychange', checkIdleTimeout);

        const interval = window.setInterval(checkIdleTimeout, 60_000);
        checkIdleTimeout();

        return () => {
            activityEvents.forEach((eventName) => {
                window.removeEventListener(eventName, handleActivity);
            });
            window.removeEventListener('focus', checkIdleTimeout);
            document.removeEventListener('visibilitychange', checkIdleTimeout);
            window.clearInterval(interval);
        };
    }, [router]);

    return (
        <div className="relative min-h-screen bg-slate-50/40 text-slate-950 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 left-0 z-0 hidden w-66 border-r border-slate-200/60 bg-white/90 backdrop-blur-md lg:block" />

            {/* Subtle Decorative Premium Background Blobs */}
            <div className="pointer-events-none absolute -top-48 right-12 h-[600px] w-[600px] rounded-full bg-indigo-500/4 blur-3xl animate-pulse" />
            <div className="pointer-events-none absolute -bottom-48 -left-24 h-[600px] w-[600px] rounded-full bg-violet-500/4 blur-3xl animate-pulse animate-float-slow" />
            <div className="pointer-events-none absolute top-1/2 left-1/3 h-[400px] w-[400px] rounded-full bg-emerald-500/2 blur-3xl animate-pulse animate-float-reverse-slow" />

            <div className="flex min-h-screen relative z-10">
                <AppSidebar />
                <div className="flex min-h-screen flex-1 flex-col">
                    <AppTopbar title={title} subtitle={subtitle} />
                    <main className="flex-1 px-4 py-5 md:px-6 lg:px-8">
                        <div className="mx-auto w-full max-w-7xl">{children}</div>
                    </main>
                </div>
            </div>
        </div>
    );
}
