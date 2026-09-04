"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Customer,
  CustomerVehicle,
} from "@/types/customer";

import {
  SystemPreparation,
} from "@/types/system-preparation";

import {
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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatTry(
  value: number
) {
  return new Intl.NumberFormat(
    "tr-TR",
    {
      style: "currency",
      currency: "TRY",
    }
  ).format(value);
}

interface Props {
  open: boolean;

  customer:
    Customer | null;

  vehicle:
    CustomerVehicle | null;

  onOpenChange:
    (open: boolean) => void;

  onSaved:
    (
      offer:
        CustomerSystemOffer
    ) => void;
}

export function CustomerSystemOfferDialog({
  open,
  customer,
  vehicle,
  onOpenChange,
  onSaved,
}: Props) {
  const [
    systems,
    setSystems,
  ] =
    useState<
      SystemPreparation[]
    >([]);

  const [
    selectedId,
    setSelectedId,
  ] = useState("");

  const [
    extraDiscount,
    setExtraDiscount,
  ] = useState("0");

  const [
    saving,
    setSaving,
  ] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const load =
      async () => {
        const response =
          await fetch(
            "/api/system-preparations?status=ready",
            {
              cache:
                "no-store",
            }
          );

        const result =
          await response.json();

        if (
          response.ok &&
          result.success
        ) {
          setSystems(
            result.data ??
              []
          );
        }
      };

    void load();
  }, [open]);

  const selectedSystem =
    systems.find(
      (system) =>
        system.id ===
        selectedId
    ) ?? null;

  const selectItems =
    useMemo(
      () =>
        systems.map(
          (system) => ({
            value:
              system.id,

            label:
              system.name,
          })
        ),
      [systems]
    );

  const discount =
    Math.max(
      0,
      Number(
        extraDiscount
      ) || 0
    );

  const finalCustomerTotal =
    selectedSystem
      ? Math.max(
          0,

          selectedSystem.customerTotalTry -
            discount
        )
      : 0;

  const finalProfit =
    selectedSystem
      ? selectedSystem.profitTry -
        discount
      : 0;

  const save =
    async () => {
      if (
        !customer ||
        !vehicle ||
        !selectedSystem
      ) {
        return;
      }

      setSaving(true);

      try {
        const response =
          await fetch(
            "/api/customer-system-offers",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  customerId:
                    customer.id,

                  vehicleId:
                    vehicle.id,

                  readySystemId:
                    selectedSystem.id,

                  extraDiscountTry:
                    discount,
                }),
            }
          );

        const result =
          await response.json();

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.message
          );
        }

        onSaved(
          result.data
        );

        setSelectedId("");
        setExtraDiscount(
          "0"
        );

        onOpenChange(false);
      } finally {
        setSaving(false);
      }
    };

  return (
    <Dialog
      open={open}
      onOpenChange={
        onOpenChange
      }
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Sistem Teklifi Ekle
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>
              Hazır Sistem
            </Label>

            <Select
              items={
                selectItems
              }
              value={
                selectedId
              }
              onValueChange={(
                value
              ) =>
                setSelectedId(
                  value ?? ""
                )
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Hazır sistem seçiniz" />
              </SelectTrigger>

              <SelectContent>
                {systems.map(
                  (system) => (
                    <SelectItem
                      key={
                        system.id
                      }
                      value={
                        system.id
                      }
                    >
                      {
                        system.name
                      }
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedSystem && (
            <>
              <div className="space-y-2 rounded-xl border p-4">
                {selectedSystem.items.map(
                  (item) => (
                    <div
                      key={
                        item.id
                      }
                      className="flex justify-between gap-4 text-sm"
                    >
                      <div>
                        <div className="font-medium">
                          {
                            item.label
                          }
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {item.brand} -{" "}
                          {item.model}
                          {" • "}
                          {
                            item.quantity
                          }{" "}
                          adet
                        </div>
                      </div>

                      <div className="font-medium">
                        $
                        {(
                          item.totalPriceUsd ??
                          0
                        ).toFixed(
                          2
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>
                    Hazır Sistem
                    Tutarı
                  </Label>

                  <div className="rounded-md border bg-muted/30 px-3 py-2 font-semibold">
                    {formatTry(
                      selectedSystem.customerTotalTry
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>
                    Hazır Sistem
                    Kazancı
                  </Label>

                  <div className="rounded-md border bg-muted/30 px-3 py-2 font-semibold">
                    {formatTry(
                      selectedSystem.profitTry
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  Ek İndirim
                  (TL)
                </Label>

                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    extraDiscount
                  }
                  onChange={(e) =>
                    setExtraDiscount(
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-4">
                  <div className="text-xs text-muted-foreground">
                    Yeni Müşteri
                    Tutarı
                  </div>

                  <div className="mt-1 text-xl font-bold">
                    {formatTry(
                      finalCustomerTotal
                    )}
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="text-xs text-muted-foreground">
                    Yeni Kazanç
                  </div>

                  <div className="mt-1 text-xl font-bold">
                    {formatTry(
                      finalProfit
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() =>
              onOpenChange(
                false
              )
            }
          >
            Vazgeç
          </Button>

          <Button
            disabled={
              !selectedSystem ||
              saving
            }
            onClick={() => {
              void save();
            }}
          >
            Teklifi Ekle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}