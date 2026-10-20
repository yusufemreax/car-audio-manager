/* eslint-disable @next/next/no-img-element */
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
} from "lucide-react";
import type { PortalMultimedia } from "@/types/portal";
import { portalFetch, PortalButton, PortalMessage, money } from "./shared";
import { PortalBooking } from "./booking";
export function PortalProduct({ id }: { id: string }) {
  const [product, setProduct] = useState<PortalMultimedia | null>(null);
  const [error, setError] = useState("");
  const [image, setImage] = useState(0);
  const [booking, setBooking] = useState(false);
  useEffect(() => {
    let active = true;
    void portalFetch<PortalMultimedia>(
      `/api/portal/multimedias/${encodeURIComponent(id)}`,
    )
      .then((data) => {
        if (active) setProduct(data);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <Link
        href="/musteri#arac-sec"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500"
      >
        <ArrowLeft size={17} /> Paketlere dön
      </Link>
      {error ? (
        <div className="mt-6">
          <PortalMessage error>{error}</PortalMessage>
          <p className="mt-3 text-sm">
            Fiyat veya bulunabilirlik değiştiyse araç seçiminizi yenileyin.
          </p>
        </div>
      ) : !product ? (
        <div className="mt-10 animate-pulse rounded-3xl bg-slate-200 p-20 text-center text-slate-500">
          Multimedya hazırlanıyor...
        </div>
      ) : (
        <>
          <div className="mt-7 grid gap-9 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <section
              aria-label="Montaj ve ürün fotoğrafları"
              className="overflow-hidden rounded-3xl border border-slate-200 bg-white"
            >
              <div className="relative flex aspect-[4/3] items-center justify-center bg-[#e9ecea]">
                {product.images[image] ? (
                  <img
                    src={product.images[image].url}
                    alt={product.images[image].label}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-slate-400">
                    <ImageIcon size={50} />
                    Görsel henüz eklenmedi
                  </div>
                )}
                {product.images.length > 1 && (
                  <>
                    <button
                      aria-label="Önceki fotoğraf"
                      onClick={() =>
                        setImage(
                          (image - 1 + product.images.length) %
                            product.images.length,
                        )
                      }
                      className="absolute left-3 rounded-full bg-white/95 p-3 shadow"
                    >
                      <ChevronLeft />
                    </button>
                    <button
                      aria-label="Sonraki fotoğraf"
                      onClick={() =>
                        setImage((image + 1) % product.images.length)
                      }
                      className="absolute right-3 rounded-full bg-white/95 p-3 shadow"
                    >
                      <ChevronRight />
                    </button>
                  </>
                )}
                {product.images[image] && (
                  <span className="absolute bottom-4 left-4 rounded-full bg-slate-950/80 px-3 py-1.5 text-xs text-white">
                    {product.images[image].label} · {image + 1}/
                    {product.images.length}
                  </span>
                )}
              </div>
              <div className="flex gap-3 p-4">
                {product.images.map((photo, index) => (
                  <button
                    key={`${photo.label}-${index}`}
                    aria-label={photo.label}
                    aria-pressed={image === index}
                    onClick={() => setImage(index)}
                    className={`overflow-hidden rounded-xl border-2 ${image === index ? "border-amber-400" : "border-transparent"}`}
                  >
                    <img
                      src={photo.url}
                      alt=""
                      className="h-16 w-24 bg-slate-100 object-contain"
                    />
                  </button>
                ))}
              </div>
            </section>
            <section className="lg:sticky lg:top-28">
              <p className="text-xs font-bold tracking-[0.2em] text-amber-700">
                ARACINIZA ÖZEL PAKET
              </p>
              <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                {product.title}
              </h1>
              <p className="mt-4 text-lg font-semibold text-slate-600">
                {product.vehicle}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  product.screenSize && `${product.screenSize}″ ekran`,
                  product.ram && `${product.ram} GB RAM`,
                  product.storage && `${product.storage} GB hafıza`,
                ]
                  .filter(Boolean)
                  .map((label) => (
                    <span
                      key={label}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"
                    >
                      {label}
                    </span>
                  ))}
              </div>
              <p className="mt-6 leading-7 text-slate-500">
                {product.description}
              </p>
              <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Güncel paket fiyatı
                </p>
                <p className="mt-2 text-4xl font-black tracking-tight">
                  {money(product.priceTry)}
                </p>
                <PortalButton
                  className="mt-5 w-full"
                  onClick={() => setBooking(true)}
                >
                  <CalendarDays size={19} />
                  Montaj randevusu al
                </PortalButton>
                <p className="mt-4 text-xs leading-5 text-slate-500">
                  Uygun günler ürünün kargo süresine ve mevcut randevulara göre
                  gösterilir. Hafta içi montajlar 18.30&apos;dan itibaren
                  planlanır.
                </p>
              </div>
            </section>
          </div>
          <section className="mt-12 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <p className="text-xs font-bold tracking-[0.2em] text-amber-700">
              DONANIMI TANIYIN
            </p>
            <h2 className="mt-2 text-2xl font-black">Özellikler</h2>
            {!product.features.length ? (
              <p className="mt-5 text-slate-500">
                Ürün özellikleri henüz eklenmedi.
              </p>
            ) : (
              <dl className="mt-6 grid gap-x-10 sm:grid-cols-2">
                {product.features.map((feature) => (
                  <div
                    key={feature.label}
                    className="flex justify-between gap-4 border-b border-slate-100 py-4"
                  >
                    <dt className="text-slate-500">{feature.label}</dt>
                    <dd className="text-right font-semibold">
                      {feature.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
          <PortalBooking
            open={booking}
            onOpenChange={setBooking}
            product={product}
            onProductChange={setProduct}
          />
        </>
      )}
    </main>
  );
}
