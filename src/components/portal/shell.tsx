/* eslint-disable @next/next/no-img-element */
"use client";
import Link from "next/link";
import { WhatsAppContact } from "./whatsapp-contact";
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
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-8 sm:py-4">
          <Link
            href="/musteri"
            className="flex shrink-0 items-center gap-3"
            aria-label="Aksoy Tuning ana sayfa"
          >
            <span className="flex shrink-0 flex-col items-center">
              <span className="flex h-12 w-36 items-center justify-center overflow-hidden rounded-md bg-white sm:h-14 sm:w-44">
                <img
                  src="/LOGO.png"
                  alt="Aksoy Tuning"
                  width={1200}
                  height={400}
                  className="h-full w-full scale-125 object-contain"
                />
              </span>
              <span className="mt-1 text-[8px] font-semibold tracking-[0.12em] text-slate-500 sm:text-[9px] lg:hidden">
                BAŞİSKELE · MULTİMEDYA
              </span>
            </span>
            <span className="hidden lg:block">
              <span className="block text-lg font-black tracking-tight">
                AKSOY <span className="text-amber-600">TUNING</span>
              </span>
              <span className="block text-[10px] font-semibold tracking-[0.2em] text-slate-500">
                BAŞİSKELE · MULTİMEDYA
              </span>
            </span>
          </Link>
          <nav className="flex min-w-0 items-center gap-3 text-sm font-semibold sm:gap-5">
            <Link
              href="/musteri#arac-sec"
              className="hidden hover:text-amber-700 sm:block"
            >
              Aracını seç
            </Link>
            <Link
              href="/musteri/hesabim"
              className="max-w-[132px] truncate rounded-full border border-slate-200 px-3 py-2 text-xs hover:border-amber-500 sm:max-w-[170px] sm:px-4 sm:text-sm"
            >
              {user ? `${user.firstName} · Hesabım` : "Giriş / Üye ol"}
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <WhatsAppContact />
      <footer className="mt-16 border-t border-slate-200 bg-white pb-20">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-5 py-8 text-sm sm:flex-row sm:px-8">
          <p className="font-bold">
            AKSOY TUNING{" "}
            <span className="font-normal text-slate-500">/ Başiskele</span>
          </p>
          <p className="text-slate-500">
            Aracınıza uygun multimedya, size uygun montaj zamanı.
          </p>
          <a
            href="https://maps.app.goo.gl/rvxNvzj32AehTbXf8"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-semibold text-amber-700 hover:underline"
          >
            <span aria-hidden="true">📍</span> Dükkan konumu · Google Maps
          </a>
          <Link href="/musteri/hesabim" className="font-semibold">
            Hesabım ve randevularım →
          </Link>
        </div>
      </footer>
    </div>
  );
}
