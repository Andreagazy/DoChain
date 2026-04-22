interface ProgressProps {
    value: number;
    className?: string;
}

export function Progress({ value, className = '' }: ProgressProps) {
    const normalized = Math.max(0, Math.min(100, value));

    return (
        <div className={`h-2 w-full overflow-hidden rounded-full bg-slate-200 ${className}`} role="progressbar" aria-valuenow={normalized} aria-valuemin={0} aria-valuemax={100}>
            <div
                className="h-full rounded-full bg-blue-600 transition-all duration-300"
                style={{ width: `${normalized}%` }}
            />
        </div>
    );
}
