/* eslint-disable @next/next/no-img-element */
"use client";
import Link from "next/link";
import { VehicleRequestButton } from "./vehicle-request";
import { catalogReturn } from "./navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CarFront,
  CalendarDays,
  MonitorSmartphone,
  Check,
  Image as ImageIcon,
} from "lucide-react";
import type { PortalVehicle, PortalMultimedia } from "@/types/portal";
import {
  portalFetch,
  PortalButton,
  PortalMessage,
  fieldClass,
  money,
} from "./shared";
export function PortalCatalog() {
  const [vehicles, setVehicles] = useState<PortalVehicle[]>([]);
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const [generationId, setGenerationId] = useState("");
  const [products, setProducts] = useState<PortalMultimedia[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void portalFetch<PortalVehicle[]>("/api/portal/vehicles")
      .then(async (data) => {
        if (!active) return;
        setVehicles(data);
        const params = new URLSearchParams(window.location.search);
        const brand = data.find((item) => item.id === params.get("marka"));
        const model = brand?.models.find(
          (item) => item.id === params.get("model"),
        );
        const generation = model?.generations.find(
          (item) => item.id === params.get("kasa"),
        );
        setBrandId(brand?.id ?? "");
        setModelId(model?.id ?? "");
        setGenerationId(generation?.id ?? "");
        if (generation && params.get("paketler") === "1") {
          setLoading(true);
          try {
            const products = await portalFetch<PortalMultimedia[]>(
              `/api/portal/multimedias?generationId=${encodeURIComponent(generation.id)}`,
            );
            if (active) {
              setProducts(products);
              setSearched(true);
            }
          } finally {
            if (active) setLoading(false);
          }
        }
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoadingVehicles(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const brand = vehicles.find((item) => item.id === brandId);
  const model = brand?.models.find((item) => item.id === modelId);
  const selectionPath = (
    brand = brandId,
    model = modelId,
    generation = generationId,
    searched = false,
  ) => {
    const params = new URLSearchParams();
    if (brand) params.set("marka", brand);
    if (model) params.set("model", model);
    if (generation) params.set("kasa", generation);
    if (searched) params.set("paketler", "1");
    return `/musteri?${params}#arac-sec`;
  };
  const remember = (path: string) =>
    window.history.replaceState(window.history.state, "", path);
  const reset = () => {
    setProducts([]);
    setSearched(false);
    setError("");
  };
  return (
    <main>
      <section className="relative overflow-hidden bg-[#101719] text-white">
        <div className="absolute -right-24 top-0 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="relative">
            <p className="mb-5 flex items-center gap-2 text-xs font-bold tracking-[0.25em] text-amber-300">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> SÜRÜŞ
              DENEYİMİNİ YENİLE
            </p>
            <h1 className="max-w-2xl text-4xl font-black leading-[1.08] tracking-tight sm:text-6xl">
              Aracına uygun ekran.
              <br />
              <span className="text-amber-300">Sana uygun zaman.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-slate-300">
              Multimedya seçeneklerini ve güncel paket fiyatlarını keşfet. Örnek
              montajı gör, özellikleri karşılaştır, randevunu planla.
            </p>
            <a
              href="#arac-sec"
              className="mt-8 inline-flex min-h-12 items-center gap-4 rounded-xl bg-amber-400 px-6 py-4 font-bold text-slate-950 hover:bg-amber-300"
            >
              Multimedya fiyat teklifi al <ArrowRight size={20} />
            </a>
            <div className="mt-8 flex flex-wrap gap-5 text-xs text-slate-300">
              <span className="flex items-center gap-2">
                <Check size={15} className="text-amber-300" /> Araç bazlı
                seçenekler
              </span>
              <span className="flex items-center gap-2">
                <Check size={15} className="text-amber-300" /> Güncel paket
                fiyatı
              </span>
              <span className="flex items-center gap-2">
                <Check size={15} className="text-amber-300" /> Online randevu
              </span>
            </div>
          </div>
          <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <div className="mb-8 flex items-center justify-between">
              <span className="text-xs font-semibold tracking-widest text-slate-400">
                DAHA AKILLI BİR KOKPİT
              </span>
              <MonitorSmartphone className="text-amber-300" size={26} />
            </div>
            <div className="space-y-6">
              {[
                {
                  icon: CarFront,
                  n: "01",
                  title: "Aracını seç",
                  text: "Marka, model ve kasa bilgisiyle uyumlu paketleri bul.",
                },
                {
                  icon: MonitorSmartphone,
                  n: "02",
                  title: "Multimedyanı keşfet",
                  text: "Montaj fotoğraflarını, donanımı ve fiyatı incele.",
                },
                {
                  icon: CalendarDays,
                  n: "03",
                  title: "Zamanını ayır",
                  text: "Kargo süresine ve takvime uygun bir randevu seç.",
                },
              ].map((step) => (
                <div key={step.n} className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-300/10 text-amber-300">
                    <step.icon size={21} />
                  </div>
                  <div>
                    <p className="font-bold">
                      <span className="mr-2 text-xs text-slate-500">
                        {step.n}
                      </span>
                      {step.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      {step.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section
        id="arac-sec"
        className="mx-auto max-w-7xl scroll-mt-28 px-5 pt-12 sm:px-8"
      >
        <p className="text-xs font-bold tracking-[0.2em] text-amber-700">
          İLK ADIM · ARACINIZ
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-tight">
          Doğru paket, doğru uyum.
        </h2>
        <p className="mt-3 text-slate-500">
          Aracınızın bilgilerini seçerek size uygun hazır multimedyaları
          görüntüleyin.
        </p>
        <form
          className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-4 md:items-end"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!generationId || loading) return;
            remember(selectionPath(brandId, modelId, generationId, true));
            setLoading(true);
            setError("");
            setSearched(false);
            try {
              setProducts(
                await portalFetch<PortalMultimedia[]>(
                  `/api/portal/multimedias?generationId=${encodeURIComponent(generationId)}`,
                ),
              );
              setSearched(true);
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Paketler yüklenemedi.",
              );
            } finally {
              setLoading(false);
            }
          }}
        >
          <label className="space-y-2 text-sm font-semibold">
            Marka
            <select
              className={fieldClass}
              required
              disabled={loadingVehicles || loading}
              value={brandId}
              onChange={(event) => {
                setBrandId(event.target.value);
                remember(selectionPath(event.target.value, "", ""));
                setModelId("");
                setGenerationId("");
                reset();
              }}
            >
              <option value="">
                {loadingVehicles ? "Yükleniyor..." : "Marka seçin"}
              </option>
              {vehicles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold">
            Model
            <select
              className={fieldClass}
              required
              disabled={!brand || loading}
              value={modelId}
              onChange={(event) => {
                setModelId(event.target.value);
                remember(selectionPath(brandId, event.target.value, ""));
                setGenerationId("");
                reset();
              }}
            >
              <option value="">Model seçin</option>
              {brand?.models.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm font-semibold">
            Kasa
            <select
              className={fieldClass}
              required
              disabled={!model || loading}
              value={generationId}
              onChange={(event) => {
                setGenerationId(event.target.value);
                remember(selectionPath(brandId, modelId, event.target.value));
                reset();
              }}
            >
              <option value="">Kasa seçin</option>
              {model?.generations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.startYear}–{item.endYear}
                </option>
              ))}
            </select>
          </label>
          <PortalButton type="submit" disabled={!generationId || loading}>
            {loading ? "Paketler hazırlanıyor..." : "Paketleri göster"}
            <ArrowRight size={18} />
          </PortalButton>
        </form>
        <div className="mt-4">
          <VehicleRequestButton />
        </div>
        {error && (
          <div className="mt-5">
            <PortalMessage error>{error}</PortalMessage>
          </div>
        )}
        {searched && (
          <div className="mt-10">
            <div className="mb-5 flex items-end justify-between gap-4">
              <h2 className="text-2xl font-black">Aracınız için hazır.</h2>
              <span className="text-sm text-slate-500">
                {products.length} paket
              </span>
            </div>
            {!products.length ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
                Bu araç için şu anda uygun hazır multimedya bulunmuyor.
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <Link
                    href={`/musteri/multimedya/${product.id}?geri=${encodeURIComponent(catalogReturn(selectionPath(brandId, modelId, generationId, true)))}`}
                    key={product.id}
                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-slate-100">
                      {product.images[0] ? (
                        <img
                          src={product.images[0].url}
                          alt={`${product.vehicle} ${product.images[0].label}`}
                          className="h-full w-full object-contain transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <ImageIcon size={48} className="text-slate-300" />
                      )}
                      <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-bold shadow-sm">
                        {product.screenSize
                          ? `${product.screenSize}″`
                          : "Multimedya"}
                      </span>
                    </div>
                    {product.hasFrontRecordingCamera === true && (
                      <p className="border-y border-red-100 bg-red-50 px-5 py-2.5 text-center text-sm font-bold text-red-700">
                        Kayıt kamerası hediye
                      </p>
                    )}
                    <div className="p-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {product.vehicle}
                      </p>
                      <h3 className="mt-2 text-xl font-bold">
                        {product.title}
                      </h3>
                      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                        <div>
                          <p className="text-xs text-slate-500">
                            Güncel paket fiyatı
                          </p>
                          <p className="mt-1 text-2xl font-black">
                            {money(product.priceTry)}
                          </p>
                        </div>
                        <ArrowRight className="text-amber-700" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
