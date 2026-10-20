/* eslint-disable @next/next/no-img-element */
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { PortalUser } from "@/types/portal";
import { portalFetch } from "./shared";
export function PortalShell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PortalUser | null>(null);
  useEffect(() => {
    const refresh = () => {
      void portalFetch<PortalUser | null>("/api/portal/auth")
        .then(setUser)
        .catch(() => setUser(null));
    };
    refresh();
    window.addEventListener("portal-auth-change", refresh);
    return () => window.removeEventListener("portal-auth-change", refresh);
  }, []);
  return (
    <div className="min-h-screen bg-[#f6f6f3] text-slate-950 selection:bg-amber-200">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link
            href="/musteri"
            className="flex items-center gap-3"
            aria-label="Aksoy Tuning ana sayfa"
          >
            <img
              src="/LOGO.png"
              alt=""
              className="h-11 w-11 rounded-lg bg-slate-950 object-contain"
            />
            <span>
              <span className="block text-lg font-black tracking-tight">
                AKSOY <span className="text-amber-600">TUNING</span>
              </span>
              <span className="block text-[10px] font-semibold tracking-[0.2em] text-slate-500">
                BAŞİSKELE · MULTİMEDYA
              </span>
            </span>
          </Link>
          <nav className="flex min-w-0 items-center gap-5 text-sm font-semibold">
            <Link
              href="/musteri#arac-sec"
              className="hidden hover:text-amber-700 sm:block"
            >
              Aracını seç
            </Link>
            <Link
              href="/musteri/hesabim"
              className="max-w-[170px] truncate rounded-full border border-slate-200 px-4 py-2 hover:border-amber-500"
            >
              {user ? `${user.firstName} · Hesabım` : "Giriş / Üye ol"}
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="mt-16 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-5 py-8 text-sm sm:flex-row sm:px-8">
          <p className="font-bold">
            AKSOY TUNING{" "}
            <span className="font-normal text-slate-500">/ Başiskele</span>
          </p>
          <p className="text-slate-500">
            Aracınıza uygun multimedya, size uygun montaj zamanı.
          </p>
          <Link href="/musteri/hesabim" className="font-semibold">
            Hesabım ve randevularım →
          </Link>
        </div>
      </footer>
    </div>
  );
}
