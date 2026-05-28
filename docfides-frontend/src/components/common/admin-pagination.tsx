'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminPaginationProps {
    page: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
}

export function AdminPagination({ page, pageSize, totalItems, onPageChange }: AdminPaginationProps) {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
    const endItem = Math.min(totalItems, page * pageSize);

    return (
        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <p>
                Menampilkan {startItem}-{endItem} dari {totalItems} data
            </p>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-300"
                    onClick={() => onPageChange(Math.max(1, page - 1))}
                    disabled={page <= 1}
                >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                </Button>
                <span className="min-w-20 text-center text-xs font-medium text-slate-500">
                    {page} / {totalPages}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    className="border-slate-300"
                    onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                >
                    Next
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
