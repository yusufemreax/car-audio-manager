/* eslint-disable react-hooks/set-state-in-effect */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { catalogReturn } from "./navigation";
import { CalendarDays, Check, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type {
  PortalUser,
  PortalMultimedia,
  PortalAvailability,
  PortalAppointment,
} from "@/types/portal";
import {
  portalFetch,
  PortalHttpError,
  PortalButton,
  PortalMessage,
  fieldClass,
  fullDate,
  shortTime,
  money,
} from "./shared";
function bookingRequestId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Istanbul",
  }).format(new Date(`${date}T12:00:00Z`));
function shiftMonth(month: string, shift: number) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + shift, 15))
    .toISOString()
    .slice(0, 7);
}
export function PortalBooking({
  open,
  onOpenChange,
  product,
  onProductChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: PortalMultimedia;
  onProductChange: (product: PortalMultimedia) => void;
}) {
  const [step, setStep] = useState<"auth" | "calendar" | "done">("auth");
  const [contact, setContact] = useState({
    firstName: "",
    lastName: "",
    phone: "",
  });
  const [user, setUser] = useState<PortalUser | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [availability, setAvailability] = useState<PortalAvailability | null>(
    null,
  );
  const hoursRef = useRef<HTMLDivElement>(null);
  const scrollToHours = useRef(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [month, setMonth] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState("");
  const [saved, setSaved] = useState<PortalAppointment | null>(null);
  const loadAvailability = useCallback(async () => {
    const data = await portalFetch<PortalAvailability>(
      "/api/portal/appointments",
    );
    setAvailability(data);
    setDate((previous) =>
      data.days.some((day) => day.date === previous && day.slots.length)
        ? previous
        : "",
    );
    setTime((previous) =>
      data.days.some((day) => day.slots.includes(previous)) ? previous : "",
    );
    setMonth((previous) => {
      const first = data.earliestDate.slice(0, 7);
      const last = data.days.at(-1)?.date.slice(0, 7) ?? first;
      return previous >= first && previous <= last ? previous : first;
    });
  }, []);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    setSaved(null);
    setDate("");
    setTime("");
    setMonth("");
    setStep("auth");
    setRequestId(bookingRequestId());
    void Promise.all([
      portalFetch<PortalUser | null>("/api/portal/auth"),
      loadAvailability(),
    ])
      .then(([account]) => {
        if (!active) return;
        setUser(account);
        setVehicleId(
          account?.vehicles?.find(
            (vehicle) => vehicle.generationId === product.generationId,
          )?.id ?? "",
        );
        setContact(
          account
            ? {
                firstName: account.firstName,
                lastName: account.lastName,
                phone: account.phone,
              }
            : { firstName: "", lastName: "", phone: "" },
        );
        setStep(account ? "calendar" : "auth");
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const interval = window.setInterval(() => {
      void loadAvailability().catch(() => {});
    }, 60000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [open, loadAvailability, product.generationId]);
  useEffect(() => {
    if (!date || !scrollToHours.current) return;
    scrollToHours.current = false;
    const frame = requestAnimationFrame(() =>
      hoursRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      }),
    );
    return () => cancelAnimationFrame(frame);
  }, [date]);
  const slots =
    availability?.days.find((day) => day.date === date)?.slots ?? [];
  const [year, number] = month ? month.split("-").map(Number) : [2026, 1];
  const daysInMonth = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const leading = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7;
  const firstMonth = availability?.earliestDate.slice(0, 7) ?? month;
  const lastMonth = availability?.days.at(-1)?.date.slice(0, 7) ?? month;
  const submit = async () => {
    if (submitting || !user || !time || !requestId) return;
    setSubmitting(true);
    setError("");
    try {
      const appointment = await portalFetch<PortalAppointment>(
        "/api/portal/appointments",
        {
          method: "POST",
          body: JSON.stringify({
            multimediaId: product.id,
            expectedPriceTry: product.priceTry,
            startsAt: time,
            requestId,
            contact,
            ...(vehicleId ? { vehicleId } : {}),
          }),
        },
      );
      setSaved(appointment);
      setStep("done");
    } catch (error) {
      if (error instanceof PortalHttpError && error.status === 401) {
        setUser(null);
        setStep("auth");
        return;
      }
      setError(
        error instanceof Error ? error.message : "Randevu kaydedilemedi.",
      );
      await Promise.allSettled([
        loadAvailability(),
        portalFetch<PortalMultimedia>(
          `/api/portal/multimedias/${product.id}`,
        ).then(onProductChange),
      ]);
      setTime("");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!submitting) onOpenChange(value);
      }}
    >
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden bg-white text-slate-950 sm:max-w-2xl">
        <DialogHeader className="shrink-0 pr-6">
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <CalendarDays className="text-amber-600" />
            {step === "done" ? "Saatiniz ayrıldı." : "Montaj randevusu"}
          </DialogTitle>
          <DialogDescription>
            {product.vehicle} · {product.title}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pr-1">
          {error && <PortalMessage error>{error}</PortalMessage>}
          {loading ? (
            <p className="py-8 text-center text-slate-500">
              Uygun saatler hazırlanıyor...
            </p>
          ) : step === "done" && saved ? (
            <div className="space-y-5 py-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check size={30} />
              </div>
              <h3 className="text-2xl font-black">
                {fullDate(saved.startsAt)}
              </h3>
              <p className="text-slate-500">
                Randevu talebiniz alındı ve seçtiğiniz saat ayrıldı. Montaj
                planlaması için telefon numaranızdan sizinle iletişime
                geçeceğiz.
              </p>
              <div className="rounded-2xl bg-slate-50 p-5 text-sm leading-7">
                <p>
                  Randevu numarası: <strong>{saved.reference}</strong>
                </p>
                <p>
                  Telefon: <strong>{saved.customer.phone}</strong>
                </p>
                <p>
                  Paket fiyatı:{" "}
                  <strong>{money(saved.multimedia.priceTry)}</strong>
                </p>
              </div>
            </div>
          ) : step === "auth" ? (
            <div className="space-y-5 py-4">
              <p className="text-sm leading-7 text-slate-600">
                Montaj randevusu oluşturmak ve randevunuzu takip etmek için
                hesabınıza giriş yapın veya ücretsiz üye olun.
              </p>
              <Link
                href={`/musteri/hesabim?next=${encodeURIComponent(`/musteri/multimedya/${product.id}?randevu=1&geri=${encodeURIComponent(catalogReturn(typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("geri")))}`)}`}
                className="inline-flex rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950"
              >
                Giriş yap / Üye ol →
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm">
                <span>
                  {contact.firstName} {contact.lastName} · {contact.phone}
                </span>
              </div>
              {user &&
              (user.vehicles ?? []).some(
                (vehicle) => vehicle.generationId === product.generationId,
              ) ? (
                <label className="block space-y-2 text-sm font-semibold">
                  Randevu alınacak araç
                  <select
                    className={fieldClass}
                    value={vehicleId}
                    onChange={(event) => setVehicleId(event.target.value)}
                  >
                    {(user?.vehicles ?? [])
                      .filter(
                        (vehicle) =>
                          vehicle.generationId === product.generationId,
                      )
                      .map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.label}
                          {vehicle.plate ? ` · ${vehicle.plate}` : ""}
                        </option>
                      ))}
                  </select>
                </label>
              ) : (
                <p className="text-sm text-slate-500">
                  {product.vehicle} aracı müşteri kaydınıza eklenecek.
                </p>
              )}
              {availability?.warning && (
                <PortalMessage>{availability.warning}</PortalMessage>
              )}
              <p className="text-sm leading-6 text-slate-500">
                Kargo süresi dikkate alınarak en erken{" "}
                <strong className="text-slate-900">
                  {availability ? dateLabel(availability.earliestDate) : "—"}
                </strong>{" "}
                gösterilir. Saatler yarım saat aralıklıdır; iki montaj
                başlangıcı arasında en az 3,5 saat bulunur.
              </p>
              <section
                aria-label="Randevu takvimi"
                className="rounded-2xl border border-slate-200 p-4"
              >
                <div className="mb-4 flex items-center justify-between">
                  <button
                    aria-label="Önceki ay"
                    disabled={month <= firstMonth}
                    onClick={() => setMonth(shiftMonth(month, -1))}
                    className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-20"
                  >
                    <ChevronLeft size={19} />
                  </button>
                  <h3 className="font-bold">
                    {new Intl.DateTimeFormat("tr-TR", {
                      month: "long",
                      year: "numeric",
                      timeZone: "UTC",
                    }).format(new Date(Date.UTC(year, number - 1, 1)))}
                  </h3>
                  <button
                    aria-label="Sonraki ay"
                    disabled={month >= lastMonth}
                    onClick={() => setMonth(shiftMonth(month, 1))}
                    className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-20"
                  >
                    <ChevronRight size={19} />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map(
                    (day) => (
                      <span
                        key={day}
                        className="py-2 text-xs font-semibold text-slate-400"
                      >
                        {day}
                      </span>
                    ),
                  )}
                  {Array.from({ length: leading }, (_, index) => (
                    <span key={`pad-${index}`} />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, index) => {
                    const current = `${month}-${String(index + 1).padStart(2, "0")}`;
                    const available = availability?.days.find(
                      (day) => day.date === current,
                    );
                    return (
                      <button
                        key={current}
                        aria-label={dateLabel(current)}
                        aria-pressed={date === current}
                        disabled={!available?.slots.length || submitting}
                        onClick={() => {
                          if (date === current) {
                            hoursRef.current?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                          }
                          scrollToHours.current = true;
                          setDate(current);
                          setTime("");
                        }}
                        className={`min-h-10 rounded-lg text-sm font-semibold transition disabled:cursor-not-allowed disabled:text-slate-300 ${date === current ? "bg-slate-950 text-white" : "hover:bg-amber-100"}`}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
              </section>
              <div
                ref={hoursRef}
                tabIndex={-1}
                className="scroll-mt-4 focus:outline-none"
              >
                <h3 className="mb-3 font-bold">
                  {date ? dateLabel(date) : "Tarih seçin"} · Saat
                </h3>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      aria-pressed={time === slot}
                      disabled={submitting}
                      onClick={() => setTime(slot)}
                      className={`rounded-xl border py-3 text-sm font-bold ${time === slot ? "border-amber-400 bg-amber-400" : "border-slate-200 bg-white hover:border-amber-400"}`}
                    >
                      {shortTime(slot)}
                    </button>
                  ))}
                </div>
                {!slots.length && (
                  <p className="text-sm text-slate-500">
                    {date
                      ? "Bu tarihte uygun saat kalmadı. Başka bir gün seçin."
                      : "Saatleri görmek için takvimden bir gün seçin."}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                <span className="text-sm text-slate-500">Paket fiyatı</span>
                <strong className="text-xl">{money(product.priceTry)}</strong>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="shrink-0 bg-white">
          <PortalButton
            secondary
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            {step === "done" ? "Kapat" : "Vazgeç"}
          </PortalButton>
          {!loading && step === "calendar" && (
            <PortalButton
              disabled={!time || submitting}
              onClick={() => {
                void submit();
              }}
            >
              {submitting ? "Kaydediliyor..." : "Randevuyu oluştur"}
            </PortalButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
