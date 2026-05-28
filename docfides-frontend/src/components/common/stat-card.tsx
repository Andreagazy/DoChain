import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
    label: string;
    value: string | number;
    description?: string;
    icon?: ReactNode;
    tone?: 'blue' | 'emerald' | 'amber' | 'slate';
}

const toneClassMap = {
    blue: 'bg-indigo-50 text-indigo-600 ring-indigo-100/50 border-t-indigo-500 hover:shadow-indigo-500/10 glow-shadow-blue',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100/50 border-t-emerald-500 hover:shadow-emerald-500/10 glow-shadow-emerald',
    amber: 'bg-amber-50 text-amber-600 ring-amber-100/50 border-t-amber-500 hover:shadow-amber-500/10 glow-shadow-amber',
    slate: 'bg-slate-50 text-slate-600 ring-slate-100/50 border-t-violet-500 hover:shadow-violet-500/10 glow-shadow-blue',
};

export function StatCard({ label, value, description, icon, tone = 'slate' }: StatCardProps) {
    return (
        <Card className={`rounded-2xl border border-slate-200/60 bg-white/90 backdrop-blur-xs p-1 shadow-sm card-hover-effect border-t-2 ${toneClassMap[tone]}`}>
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">{label}</p>
                        <p className="mt-2.5 break-words text-3xl font-bold tracking-tight text-slate-800">{value}</p>
                        {description ? <p className="mt-1.5 text-xs text-slate-500 font-medium">{description}</p> : null}
                    </div>
                    {icon ? (
                        <div className={`rounded-xl p-2.5 ring-4 transition-all duration-300 ${toneClassMap[tone]}`}>
                            {icon}
                        </div>
                    ) : null}
                </div>
            </CardContent>
        </Card>
    );
}
