"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { portalFetch, fullDate } from "./shared";
interface VehicleRequest {
  id: string;
  status?: "pending" | "completed";
  completedAt?: string;
  notificationsEnabled?: boolean;
  brand: string;
  model: string;
  year: number;
  generation: string;
  customer?: { name: string; phone: string };
  createdAt: string;
}
export function VehicleRequestsAdmin() {
  const [records, setRecords] = useState<VehicleRequest[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [completing, setCompleting] = useState<string | null>(null);
  const load = useCallback(async (after?: string) => {
    setLoading(true);
    setError("");
    try {
      const result = await portalFetch<{
        records: VehicleRequest[];
        nextCursor: string | null;
      }>(
        `/api/vehicle-requests${after ? `?cursor=${encodeURIComponent(after)}` : ""}`,
      );
      setRecords((previous) =>
        after ? [...previous, ...result.records] : result.records,
      );
      setCursor(result.nextCursor);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Araç istekleri yüklenemedi.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Araç İstekleri</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Müşterilerin katalogda bulamadıkları araçlar için ilettiği talepler. Aracı kataloğa ekledikten sonra tamamlandı olarak işaretleyin.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => {
            void load();
          }}
        >
          Yenile
        </Button>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {loading && !records.length ? (
        <p>Yükleniyor...</p>
      ) : !records.length ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          Henüz araç isteği yok.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-muted">
              <tr>
                {["İşlem / Durum", "Tarih", "Marka", "Model", "Yıl", "Kasa", "Gönderen"].map(
                  (label) => (
                    <th key={label} className="p-4 text-left">
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-t">
                  <td className="p-4">
                    {record.status === "completed" ? <span className="font-semibold text-emerald-600">Tamamlandı{record.completedAt && <small className="mt-1 block font-normal">{fullDate(record.completedAt)}</small>}</span> : <>
                      <Button size="sm" disabled={completing !== null} onClick={async () => {
                        setCompleting(record.id);setError("");
                        try {
                          await portalFetch("/api/vehicle-requests", { method: "POST", body: JSON.stringify({ id: record.id, status: "completed" }) });
                          setRecords(previous => previous.map(row => row.id === record.id ? { ...row, status: "completed", completedAt: new Date().toISOString() } : row));
                        } catch(error) { setError(error instanceof Error ? error.message : "İstek tamamlanamadı."); }
                        finally { setCompleting(null); }
                      }}>{completing === record.id ? "Kaydediliyor..." : "Tamamlandı olarak işaretle"}</Button>
                      <p className="mt-2 text-xs text-muted-foreground">{record.notificationsEnabled ? "Müşteriye cihaz bildirimi gönderilecek." : "Cihaz bildirimi kaydı yok."}</p>
                    </>}
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    {fullDate(record.createdAt)}
                  </td>
                  <td className="p-4 break-words">{record.brand}</td>
                  <td className="p-4 break-words">{record.model}</td>
                  <td className="p-4">{record.year}</td>
                  <td className="p-4 break-words">
                    {record.generation || "—"}
                  </td>
                  <td className="p-4">
                    {record.customer ? (
                      <>
                        <p>{record.customer.name}</p>
                        <a
                          href={`tel:+90${record.customer.phone}`}
                          className="mt-1 block font-semibold text-blue-600"
                        >
                          {record.customer.phone}
                        </a>
                      </>
                    ) : (
                      "Misafir"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cursor && (
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => {
            void load(cursor);
          }}
        >
          {loading ? "Yükleniyor..." : "Daha fazla göster"}
        </Button>
      )}
    </div>
  );
}
