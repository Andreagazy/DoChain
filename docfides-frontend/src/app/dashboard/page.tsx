'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AxiosError } from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/empty-state';
import { StatCard } from '@/components/common/stat-card';
import { AppShell } from '@/components/layout/app-shell';
import { AlertCircle, FileCheck2, FileText, Loader2, Mail, ShieldCheck, User as UserIcon } from 'lucide-react';
import api from '@/lib/axios';
import { getIdentityStatus, listMyCertificationDocuments, logout } from '@/lib/auth-service';
import { IdentityStatus, User } from '@/types/auth';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [identityStatus, setIdentityStatus] = useState<IdentityStatus>('NOT_SUBMITTED');
  const [docTotal, setDocTotal] = useState(0);
  const [pendingDocs, setPendingDocs] = useState(0);
  const [signedDocs, setSignedDocs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canReviewIdentity = user?.role === 'ADMIN' || user?.role === 'VERIFIER';

  useEffect(() => {
    async function loadProfile() {
      try {
        const [res, statusRes] = await Promise.all([
          api.get('/auth/me'),
          getIdentityStatus(),
        ]);

        setUser(res.data as User);
        setIdentityStatus(statusRes.status);

        if (statusRes.status === 'APPROVED') {
          const docsRes = await listMyCertificationDocuments();

          setDocTotal(docsRes.documents.length);
          setPendingDocs(
            docsRes.documents.filter((doc) => {
              const status = doc.status.toLowerCase();
              return status.includes('pending') || status.includes('partially');
            }).length,
          );
          setSignedDocs(
            docsRes.documents.filter((doc) => {
              const status = doc.status.toLowerCase();
              return status.includes('signed') || status.includes('approved');
            }).length,
          );
        } else {
          setDocTotal(0);
          setPendingDocs(0);
          setSignedDocs(0);
        }
      } catch (err) {
        const axiosError = err as AxiosError;
        if (axiosError.response?.status === 401) {
          setError('Sesi login berakhir. Silakan login kembali.');
          logout();
          setTimeout(() => {
            router.push('/login');
          }, 1500);
          return;
        }

        setError('Gagal memuat data dashboard. Silakan coba lagi.');
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="animate-spin" />
          <span>Memuat profil...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md border-red-200 bg-white">
          <CardContent className="pt-6">
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AppShell title="Dashboard" subtitle="Monitor document pipeline and continue your certification workflow.">
      <div className="space-y-6">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Documents"
            value={docTotal}
            description="All uploaded documents"
            icon={<FileText className="h-4 w-4" />}
          />
          <StatCard
            label="Pending Signatures"
            value={pendingDocs}
            description="Need action from signer"
            icon={<FileCheck2 className="h-4 w-4" />}
          />
          <StatCard
            label="Fully Signed"
            value={signedDocs}
            description="Finalized and verified"
            icon={<ShieldCheck className="h-4 w-4" />}
          />
          <StatCard
            label="Identity Status"
            value={identityStatus}
            description="Required for certification"
            icon={<UserIcon className="h-4 w-4" />}
          />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
          <Card className="border-slate-200 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Move faster through your daily certification tasks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Link href="/documents/upload">
                  <Button className="w-full">Upload New Document</Button>
                </Link>
                <Link href="/documents">
                  <Button variant="outline" className="w-full border-slate-300">Manage Documents</Button>
                </Link>
                <Link href="/certification">
                  <Button variant="outline" className="w-full border-slate-300">Start Certification</Button>
                </Link>
                <Link href="/signature-setup?next=/certification">
                  <Button variant="outline" className="w-full border-slate-300">Setup Signature</Button>
                </Link>
                <Link href="/identity" className="sm:col-span-2">
                  <Button variant="outline" className="w-full border-slate-300">Manage Identity Verification</Button>
                </Link>
                {canReviewIdentity ? (
                  <Link href="/verifier" className="sm:col-span-2">
                    <Button className="w-full">Review Member Identity Requests</Button>
                  </Link>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle>Account Summary</CardTitle>
              <CardDescription>Signed in as active team member.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 text-slate-500" />
                <div>
                  <p className="text-slate-500">Email</p>
                  <p className="font-medium text-slate-900">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <UserIcon className="mt-0.5 h-4 w-4 text-slate-500" />
                <div>
                  <p className="text-slate-500">Role</p>
                  <p className="font-medium capitalize text-slate-900">{user?.role}</p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-slate-600">Identity Gate</span>
                <Badge variant={identityStatus === 'APPROVED' ? 'success' : 'warning'}>{identityStatus}</Badge>
              </div>
            </CardContent>
          </Card>
        </section>

        {docTotal === 0 ? (
          <EmptyState
            title="No documents yet"
            description="Start by uploading your first PDF to activate certification workflow and signer assignment."
            action={
              <Link href="/documents/upload">
                <Button>Upload your first document</Button>
              </Link>
            }
          />
        ) : null}
      </div>
    </AppShell>
  );
}
