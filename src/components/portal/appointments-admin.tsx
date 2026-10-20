"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { PortalAppointment } from "@/types/portal";
import { portalFetch, fullDate, money } from "./shared";
import { Button } from "@/components/ui/button";
export function PortalAppointmentsAdmin() {
  const [records, setRecords] = useState<PortalAppointment[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const load = useCallback(async () => {
    try {
      setRecords(
        await portalFetch<PortalAppointment[]>("/api/customer-appointments"),
      );
      setError("");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Randevular yüklenemedi.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  const change = async (
    appointment: PortalAppointment,
    status: "confirmed" | "cancelled",
  ) => {
    if (busy) return;
    if (
      status === "cancelled" &&
      !window.confirm(
        `${appointment.customer.firstName} ${appointment.customer.lastName} randevusu iptal edilsin mi? Saat yeniden seçilebilir olacak. Müşteri teklifi ve başlamış sipariş işlemleri korunur.`,
      )
    )
      return;
    setBusy(appointment.id);
    setError("");
    try {
      await portalFetch("/api/customer-appointments", {
        method: "POST",
        body: JSON.stringify({ id: appointment.id, status }),
      });
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : "İşlem başarısız.");
    } finally {
      setBusy("");
    }
  };
  const filtered = records
    .filter((record) => filter === "all" || record.status === filter)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Müşteri Montaj Randevuları</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Müşteri sitesinde ayrılan saatleri ve iletişim bilgilerini yönetin.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={loading || Boolean(busy)}
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            Yenile
          </Button>
          <Link
            href="/musteri"
            target="_blank"
            className="rounded-lg border px-4 py-2 text-sm font-semibold"
          >
            Müşteri sitesini aç ↗
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          { id: "pending", label: "İletişim bekleyen" },
          { id: "confirmed", label: "Onaylı" },
          { id: "cancelled", label: "İptal" },
          { id: "all", label: "Hepsi" },
        ].map((item) => (
          <Button
            key={item.id}
            variant={filter === item.id ? "default" : "outline"}
            onClick={() => setFilter(item.id)}
          >
            {item.label} (
            {
              records.filter(
                (record) => item.id === "all" || record.status === item.id,
              ).length
            }
            )
          </Button>
        ))}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {loading ? (
        <p>Yükleniyor...</p>
      ) : !filtered.length ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          Bu durumda randevu yok.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[950px] text-sm">
            <thead className="bg-muted">
              <tr>
                {[
                  "İşlemler",
                  "Randevu",
                  "Müşteri / Telefon",
                  "Araç / Paket",
                  "Fiyat",
                  "Durum",
                ].map((label) => (
                  <th key={label} className="p-4 text-left">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((record) => (
                <tr key={record.id} className="border-t">
                  <td className="p-4">
                    <div className="flex gap-2">
                      {record.status === "pending" && (
                        <Button
                          size="sm"
                          disabled={Boolean(busy)}
                          onClick={() => {
                            void change(record, "confirmed");
                          }}
                        >
                          Onayla ve siparişe al
                        </Button>
                      )}
                      {record.status !== "cancelled" && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={Boolean(busy)}
                          onClick={() => {
                            void change(record, "cancelled");
                          }}
                        >
                          İptal Et
                        </Button>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="font-medium">{fullDate(record.startsAt)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {record.reference}
                    </p>
                  </td>
                  <td className="p-4">
                    <p>
                      {record.customer.firstName} {record.customer.lastName}
                    </p>
                    <a
                      href={`tel:+90${record.customer.phone}`}
                      className="mt-1 block font-semibold text-blue-600"
                    >
                      {record.customer.phone}
                    </a>
                  </td>
                  <td className="p-4">
                    <p className="font-medium">{record.multimedia.vehicle}</p>
                    <p className="mt-1 text-muted-foreground">
                      {record.multimedia.title}
                    </p>
                  </td>
                  <td className="p-4 font-semibold">
                    {money(record.multimedia.priceTry)}
                  </td>
                  <td className="p-4">
                    {record.status === "pending"
                      ? "İletişim bekleniyor"
                      : record.status === "confirmed"
                        ? "Onaylı"
                        : "İptal"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Randevu gönderildiğinde müşteri, araç ve teklif kaydı oluşur. Onaylanan
        teklif Sipariş adımına geçer; sipariş tamamlama, stok ve tahsilat
        işlemlerine mevcut ekranlardan devam edebilirsiniz. Randevu iptali
        teklif veya siparişi geri almaz; yalnızca takvimdeki saati serbest
        bırakır.
      </p>
    </div>
  );
}
