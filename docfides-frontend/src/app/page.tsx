import Link from 'next/link';
import {
    ArrowRight,
    CheckCircle2,
    FileCheck2,
    FileSignature,
    Fingerprint,
    KeyRound,
    LockKeyhole,
    QrCode,
    ShieldCheck,
    Workflow,
} from 'lucide-react';

const features = [
    {
        icon: Fingerprint,
        title: 'Identitas Terverifikasi',
        description: 'Setiap akun melalui validasi identitas sebelum dapat mengikuti proses sertifikasi.',
    },
    {
        icon: Workflow,
        title: 'Signer Berurutan',
        description: 'Urutan tanda tangan mengikuti tingkatan peran, dari mahasiswa sampai jurusan.',
    },
    {
        icon: QrCode,
        title: 'QR untuk Dokumen Cetak',
        description: 'Dokumen final diberi QR agar hasil cetak tetap bisa diverifikasi ulang.',
    },
    {
        icon: LockKeyhole,
        title: 'Proof Final',
        description: 'Hash dokumen final dicatat ke blockchain dan dokumen final disimpan ke IPFS.',
    },
];

export default function HomePage() {
    return (
        <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
            <section className="relative min-h-[92vh] overflow-hidden bg-[#eef4fb]">
                <div className="absolute inset-0">
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(30,64,175,0.08)_1px,transparent_1px),linear-gradient(0deg,rgba(30,64,175,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
                    <div className="absolute left-[8%] top-[14%] h-64 w-48 rotate-[-8deg] rounded-md border border-blue-100 bg-white shadow-xl shadow-blue-200/40">
                        <div className="border-b border-slate-100 px-4 py-3">
                            <div className="h-2 w-24 rounded bg-slate-200" />
                            <div className="mt-2 h-2 w-16 rounded bg-blue-200" />
                        </div>
                        <div className="space-y-3 p-4">
                            <div className="h-2 rounded bg-slate-100" />
                            <div className="h-2 rounded bg-slate-100" />
                            <div className="h-2 w-2/3 rounded bg-slate-100" />
                            <div className="mt-6 h-8 rounded border border-dashed border-blue-200 bg-blue-50" />
                            <div className="ml-auto mt-10 h-10 w-10 rounded border border-slate-200 bg-white p-1">
                                <div className="h-full w-full bg-[linear-gradient(90deg,#0f172a_25%,transparent_25%,transparent_50%,#0f172a_50%,#0f172a_75%,transparent_75%),linear-gradient(0deg,#0f172a_25%,transparent_25%,transparent_50%,#0f172a_50%,#0f172a_75%,transparent_75%)] bg-[size:8px_8px]" />
                            </div>
                        </div>
                    </div>
                    <div className="absolute right-[7%] top-[18%] h-72 w-56 rotate-[7deg] rounded-md border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
                        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                            <ShieldCheck className="h-4 w-4 text-blue-600" />
                            <div className="h-2 w-24 rounded bg-slate-200" />
                        </div>
                        <div className="space-y-3 p-4">
                            {[1, 2, 3, 4].map((item) => (
                                <div key={item} className="flex items-center gap-3 rounded border border-slate-100 bg-slate-50 px-3 py-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    <div className="h-2 flex-1 rounded bg-slate-200" />
                                </div>
                            ))}
                            <div className="mt-5 rounded border border-blue-100 bg-blue-50 p-3">
                                <div className="h-2 w-20 rounded bg-blue-200" />
                                <div className="mt-2 h-2 w-full rounded bg-blue-100" />
                                <div className="mt-2 h-2 w-2/3 rounded bg-blue-100" />
                            </div>
                        </div>
                    </div>
                </div>

                <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
                    <Link href="/" className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm">
                            <FileCheck2 className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-lg font-extrabold tracking-tight text-slate-950">DOCChain</p>
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Research Prototype</p>
                        </div>
                    </Link>
                    <div className="flex items-center gap-2">
                        <Link href="/verify-document" className="hidden rounded-md border border-blue-100 bg-white px-4 py-2 text-sm font-bold text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 sm:inline-flex">
                            Verifikasi
                        </Link>
                        <Link href="/login" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700">
                            Masuk
                        </Link>
                    </div>
                </nav>

                <div className="relative z-10 mx-auto flex min-h-[calc(92vh-80px)] max-w-7xl items-center px-5 pb-24 pt-10 lg:px-8">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 rounded-md border border-blue-100 bg-white/85 px-3 py-2 text-xs font-bold uppercase tracking-wide text-blue-700 shadow-sm backdrop-blur-sm">
                            <KeyRound className="h-3.5 w-3.5" />
                            Prototipe penelitian sertifikasi dokumen
                        </div>
                        <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
                            DOCChain
                        </h1>
                        <p className="mt-5 max-w-2xl text-lg font-medium leading-8 text-slate-700">
                            Prototipe sistem sertifikasi dokumen digital berbasis tanda tangan digital, IPFS, dan blockchain untuk mendukung verifikasi keaslian dokumen final.
                        </p>
                        <p className="mt-8 max-w-xl text-xs font-medium leading-5 text-slate-500">
                            Sistem ini merupakan prototipe untuk kebutuhan penelitian/skripsi dan bukan layanan resmi institusi.
                        </p>
                    </div>
                </div>
            </section>

            <section className="border-y border-slate-200 bg-white">
                <div className="mx-auto grid max-w-7xl gap-8 px-5 py-20 md:grid-cols-[0.9fr_1.1fr_1.1fr] lg:px-8">
                    <div className="md:pr-6">
                        <p className="text-sm font-bold uppercase tracking-wide text-blue-600">Masalah</p>
                        <h2 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-slate-950">
                            Dokumen digital perlu bukti final yang dapat diverifikasi ulang.
                        </h2>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-6">
                        <p className="text-base font-semibold leading-8 text-slate-700">
                            Proses administrasi akademik sering melibatkan dokumen PDF, tanda tangan berjenjang, dan kebutuhan untuk memastikan file tidak berubah setelah disahkan.
                        </p>
                    </div>
                    <div className="rounded-md border border-blue-100 bg-blue-50 p-6">
                        <p className="text-base font-semibold leading-8 text-slate-700">
                            DOCChain menggabungkan tanda tangan digital, QR verification, IPFS, dan pencatatan hash final di blockchain private sebagai rancangan solusi yang dapat diuji.
                        </p>
                    </div>
                </div>
            </section>

            <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                    <div>
                        <p className="text-sm font-bold uppercase tracking-wide text-blue-600">Fitur Inti</p>
                        <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">Dirancang untuk alur sertifikasi dokumen akademik.</h2>
                    </div>
                    <Link href="/verify-document" className="inline-flex w-fit items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
                        Coba Verifikasi
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>

                <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {features.map((feature) => {
                        const Icon = feature.icon;
                        return (
                            <article key={feature.title} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-blue-700">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <h3 className="mt-4 text-base font-extrabold text-slate-950">{feature.title}</h3>
                                <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
                            </article>
                        );
                    })}
                </div>
            </section>

            <section className="border-t border-blue-100 bg-[#eef4fb] text-slate-950">
                <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-12 md:flex-row md:items-center md:justify-between lg:px-8">
                    <div>
                        <p className="text-sm font-bold uppercase tracking-wide text-blue-700">DOCChain</p>
                        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Verifikasi dokumen final tanpa masuk sistem.</h2>
                        <p className="mt-2 text-sm text-slate-600">Gunakan halaman publik untuk scan QR atau upload PDF final.</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link href="/verify-document" className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700">
                            Verifikasi File
                            <FileSignature className="h-4 w-4" />
                        </Link>
                        <Link href="/login" className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-sm transition hover:bg-blue-50">
                            Masuk
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    );
}
