import { ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'destructive' | 'neutral';

const variantClassMap: Record<BadgeVariant, string> = {
    default: 'bg-blue-100 text-blue-700 border-blue-200',
    success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    destructive: 'bg-rose-100 text-rose-700 border-rose-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
};

interface BadgeProps {
    children: ReactNode;
    variant?: BadgeVariant;
    className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${variantClassMap[variant]} ${className}`}
        >
            {children}
        </span>
    );
}
