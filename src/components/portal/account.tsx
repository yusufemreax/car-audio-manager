"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { VehicleChoices, type VehicleChoice } from "./vehicle-choices";
import type { PortalUser, PortalAppointment } from "@/types/portal";
import {
  portalFetch,
  PortalButton,
  PortalMessage,
  fieldClass,
  fullDate,
  money,
} from "./shared";
export function PortalAccount() {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [appointments, setAppointments] = useState<PortalAppointment[]>([]);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [vehicles, setVehicles] = useState<VehicleChoice[]>([
    { generationId: "", plate: "" },
  ]);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    password: "",
  });
  useEffect(() => {
    let active = true;
    void portalFetch<PortalUser | null>("/api/portal/auth")
      .then(async (account) => {
        if (!active) return;
        setUser(account);
        if (account) {
          const records = await portalFetch<PortalAppointment[]>(
            "/api/portal/my-appointments",
          );
          if (active) setAppointments(records);
        }
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <p className="text-xs font-bold tracking-[0.2em] text-amber-700">
        MÜŞTERİ HESABI
      </p>
      <h1 className="mt-3 text-3xl font-black">
        {user
          ? `Merhaba, ${user.firstName}.`
          : "Bir sonraki sürüşüne hazır mısın?"}
      </h1>
      {error && (
        <div className="mt-5">
          <PortalMessage error>{error}</PortalMessage>
        </div>
      )}
      {loading ? (
        <p className="mt-8 text-slate-500">Hesap yükleniyor...</p>
      ) : user ? (
        <div className="mt-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div>
              <p className="font-bold">
                {user.firstName} {user.lastName}
              </p>
              <p className="mt-1 text-sm text-slate-500">{user.phone}</p>
            </div>
            <PortalButton
              secondary
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await portalFetch("/api/portal/auth", {
                    method: "POST",
                    body: JSON.stringify({ action: "logout" }),
                  });
                  setUser(null);
                  setAppointments([]);
                  window.dispatchEvent(new Event("portal-auth-change"));
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Çıkış yapılamadı.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Çıkış yap
            </PortalButton>
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-black">Araçlarım</h2>
            {user.vehicles?.length ? (
              user.vehicles.map((vehicle) => (
                <p key={vehicle.id} className="mt-3 text-sm text-slate-600">
                  {vehicle.label}
                  {vehicle.plate ? ` · ${vehicle.plate}` : ""}
                </p>
              ))
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Randevu aldığınız araç hesabınıza eklenecek.
              </p>
            )}
          </section>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">Randevularım</h2>
            <Link
              href="/musteri#arac-sec"
              className="text-sm font-semibold text-amber-700"
            >
              Yeni paket bul →
            </Link>
          </div>
          {!appointments.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
              Hesabınızla oluşturulmuş bir randevu yok.
            </div>
          ) : (
            appointments.map((appointment) => (
              <article
                key={appointment.id}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <h3 className="font-bold">
                    {fullDate(appointment.startsAt)}
                  </h3>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${appointment.status === "cancelled" ? "bg-red-50 text-red-700" : appointment.status === "confirmed" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}
                  >
                    {appointment.status === "cancelled"
                      ? "İptal edildi"
                      : appointment.status === "confirmed"
                        ? "Onaylandı"
                        : "İletişim bekleniyor"}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  {appointment.multimedia.vehicle} ·{" "}
                  {appointment.multimedia.title}
                </p>
                <div className="mt-4 flex justify-between text-sm">
                  <span className="text-slate-400">
                    {appointment.reference}
                  </span>
                  <strong>{money(appointment.multimedia.priceTry)}</strong>
                </div>
              </article>
            ))
          )}
        </div>
      ) : (
        <section className="mt-8 grid gap-8 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-black">
              {mode === "login" ? "Tekrar hoş geldin." : "Hesabını oluştur."}
            </h2>
            <p className="mt-4 leading-7 text-slate-500">
              Paketleri ücretsiz inceleyebilir, montaj randevunu hesabınla takip
              edebilirsin.
            </p>
            <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              Telefon numaranızın doğru olduğundan emin olunuz. Randevu için
              sizinle bu numaradan iletişime geçilecektir.
            </div>
            <p className="mt-6 text-sm text-slate-500">
              {mode === "login"
                ? "Henüz hesabın yok mu?"
                : "Zaten hesabın var mı?"}{" "}
              <button
                className="font-bold text-slate-950 underline"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setError("");
                }}
              >
                {mode === "login" ? "Üye ol" : "Giriş yap"}
              </button>
            </p>
          </div>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              try {
                const account = await portalFetch<PortalUser>(
                  "/api/portal/auth",
                  {
                    method: "POST",
                    body: JSON.stringify({ action: mode, ...form, vehicles }),
                  },
                );
                setUser(account);
                setForm({ ...form, password: "" });
                window.dispatchEvent(new Event("portal-auth-change"));
                setAppointments(
                  await portalFetch<PortalAppointment[]>(
                    "/api/portal/my-appointments",
                  ),
                );
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "İşlem tamamlanamadı.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {mode === "register" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-semibold">
                  Ad
                  <input
                    className={fieldClass}
                    required
                    minLength={2}
                    maxLength={60}
                    autoComplete="given-name"
                    value={form.firstName}
                    onChange={(event) =>
                      setForm({ ...form, firstName: event.target.value })
                    }
                  />
                </label>
                <label className="space-y-2 text-sm font-semibold">
                  Soyad
                  <input
                    className={fieldClass}
                    required
                    minLength={2}
                    maxLength={60}
                    autoComplete="family-name"
                    value={form.lastName}
                    onChange={(event) =>
                      setForm({ ...form, lastName: event.target.value })
                    }
                  />
                </label>
              </div>
            )}
            <label className="block space-y-2 text-sm font-semibold">
              Cep telefonu
              <input
                className={fieldClass}
                type="tel"
                inputMode="tel"
                required
                maxLength={18}
                placeholder="05xx xxx xx xx"
                autoComplete="username"
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
              />
            </label>
            <label className="block space-y-2 text-sm font-semibold">
              Şifre
              <input
                className={fieldClass}
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                placeholder="En az 8 karakter"
                value={form.password}
                onChange={(event) =>
                  setForm({ ...form, password: event.target.value })
                }
              />
            </label>
            {mode === "register" && (
              <VehicleChoices
                value={vehicles}
                onChange={setVehicles}
                disabled={busy}
              />
            )}
            <PortalButton type="submit" className="w-full" disabled={busy}>
              {busy
                ? "İşleniyor..."
                : mode === "login"
                  ? "Giriş yap"
                  : "Hesabımı oluştur"}
            </PortalButton>
          </form>
        </section>
      )}
    </main>
  );
}
