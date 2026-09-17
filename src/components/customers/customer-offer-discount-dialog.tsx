/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  Loader2,
  Pencil,
} from "lucide-react";

import type {
  CustomerSystemOffer,
} from "@/types/customer-system-offer";
import {
  Button,
} from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Input,
} from "@/components/ui/input";
import {
  Label,
} from "@/components/ui/label";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

interface Props {
  offer: CustomerSystemOffer | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (offer: CustomerSystemOffer) => void;
}

function formatTry(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(value);
}

export function CustomerOfferDiscountDialog({
  offer,
  onOpenChange,
  onSaved,
}: Props) {
  const [discount, setDiscount] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!offer) {
      setDiscount("0");
      setError(null);
      return;
    }

    setDiscount(
      String(
        offer.extraDiscountTry ?? 0
      )
    );
    setError(null);
  }, [offer]);

  const discountValue = Math.max(
    0,
    Number(discount) || 0
  );
  const baseCustomerTotal =
    offer?.systemSnapshot.customerTotalTry ?? 0;
  const baseProfit =
    offer?.systemSnapshot.profitTry ?? 0;
  const finalCustomerTotal = Math.max(
    0,
    baseCustomerTotal - discountValue
  );
  const finalProfit =
    baseProfit - discountValue;

  const save = async () => {
    if (!offer) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/customer-system-offers/${encodeURIComponent(offer.id)}/discount`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            extraDiscountTry:
              discountValue,
          }),
        }
      );
      const result:
        ApiResponse<CustomerSystemOffer> =
          await response.json();

      if (
        !response.ok ||
        !result.success ||
        !result.data
      ) {
        throw new Error(
          result.message ??
            "Teklif indirimi güncellenemedi."
        );
      }

      onSaved(result.data);
      onOpenChange(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Teklif indirimi güncellenemedi."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={Boolean(offer)}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4" />
            Multimedya Teklifini Düzenle
          </DialogTitle>
        </DialogHeader>

        {offer && (
          <div className="space-y-5">
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="font-semibold">
                {offer.systemSnapshot.name}
              </div>
              {offer.systemSnapshot.additionalDescription && (
                <div className="mt-1 text-sm text-muted-foreground">
                  {offer.systemSnapshot.additionalDescription}
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label>Ek İndirim (TL)</Label>
              <Input
                type="number"
                min="0"
                max={baseCustomerTotal}
                step="0.01"
                value={discount}
                onChange={(event) =>
                  setDiscount(
                    event.target.value
                  )
                }
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <div className="text-xs text-muted-foreground">
                  Yeni Müşteri Tutarı
                </div>
                <div className="mt-1 text-lg font-bold">
                  {formatTry(finalCustomerTotal)}
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <div className="text-xs text-muted-foreground">
                  Yeni Kazanç
                </div>
                <div
                  className={`mt-1 text-lg font-bold ${
                    finalProfit < 0
                      ? "text-destructive"
                      : ""
                  }`}
                >
                  {formatTry(finalProfit)}
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() =>
              onOpenChange(false)
            }
          >
            Vazgeç
          </Button>
          <Button
            disabled={
              !offer ||
              saving ||
              discountValue >
                baseCustomerTotal
            }
            onClick={() => void save()}
          >
            {saving && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {saving
              ? "Kaydediliyor..."
              : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
