/* eslint-disable react-hooks/set-state-in-effect */
"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Phone,
} from "lucide-react";
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
  const [step, setStep] = useState<"contact" | "calendar" | "done">("contact");
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
        : (data.days.find((day) => day.slots.length)?.date ??
          data.earliestDate),
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
    setStep("contact");
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
        setStep(account ? "calendar" : "contact");
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
  const slots =
    availability?.days.find((day) => day.date === date)?.slots ?? [];
  const [year, number] = month ? month.split("-").map(Number) : [2026, 1];
  const daysInMonth = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const leading = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7;
  const firstMonth = availability?.earliestDate.slice(0, 7) ?? month;
  const lastMonth = availability?.days.at(-1)?.date.slice(0, 7) ?? month;
  const submit = async () => {
    if (submitting || !time || !requestId) return;
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
          ) : step === "contact" ? (
            <form
              id="portal-contact"
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                let phone = contact.phone.replace(/\D/g, "");
                if (phone.length === 12 && phone.startsWith("90"))
                  phone = phone.slice(2);
                if (phone.length === 11 && phone.startsWith("0"))
                  phone = phone.slice(1);
                if (
                  !/^5\d{9}$/.test(phone) ||
                  contact.firstName.trim().length < 2 ||
                  contact.lastName.trim().length < 2
                ) {
                  setError(
                    "Ad, soyad ve cep telefonu bilgilerinizi kontrol edin.",
                  );
                  return;
                }
                setContact({
                  firstName: contact.firstName.trim(),
                  lastName: contact.lastName.trim(),
                  phone,
                });
                setError("");
                setStep("calendar");
              }}
            >
              <p className="text-sm text-slate-500">
                Randevu için iletişim bilgilerinizi bırakın. Üyelik zorunlu
                değil.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-semibold">
                  Adınız
                  <input
                    className={fieldClass}
                    required
                    minLength={2}
                    maxLength={60}
                    autoComplete="given-name"
                    value={contact.firstName}
                    onChange={(event) =>
                      setContact({ ...contact, firstName: event.target.value })
                    }
                  />
                </label>
                <label className="space-y-2 text-sm font-semibold">
                  Soyadınız
                  <input
                    className={fieldClass}
                    required
                    minLength={2}
                    maxLength={60}
                    autoComplete="family-name"
                    value={contact.lastName}
                    onChange={(event) =>
                      setContact({ ...contact, lastName: event.target.value })
                    }
                  />
                </label>
              </div>
              <label className="block space-y-2 text-sm font-semibold">
                Cep telefonu
                <input
                  className={fieldClass}
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  minLength={10}
                  maxLength={18}
                  placeholder="05xx xxx xx xx"
                  value={contact.phone}
                  onChange={(event) =>
                    setContact({ ...contact, phone: event.target.value })
                  }
                />
              </label>
              <PortalMessage>
                <Phone className="mr-2 inline" size={16} />
                Telefon numaranızın doğru olduğundan emin olunuz. Randevu için
                sizinle bu numaradan iletişime geçilecektir.
              </PortalMessage>
              <p className="text-xs text-slate-500">
                Hesabınız var mı?{" "}
                <Link
                  href="/musteri/hesabim"
                  className="font-semibold underline"
                >
                  Giriş yapabilir veya üye olabilirsiniz.
                </Link>
              </p>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm">
                <span>
                  {contact.firstName} {contact.lastName} · {contact.phone}
                </span>
                {!user && (
                  <button
                    onClick={() => setStep("contact")}
                    className="font-semibold underline"
                  >
                    Bilgileri değiştir
                  </button>
                )}
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
              <div>
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
                    Bu tarihte uygun saat kalmadı. Başka bir gün seçin.
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
          {!loading && step === "contact" && (
            <PortalButton
              type="submit"
              form="portal-contact"
              disabled={!availability}
            >
              Devam →
            </PortalButton>
          )}
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
