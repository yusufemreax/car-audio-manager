"use client";

import {
  FormEvent,
  useState,
} from "react";

import {
  Customer,
} from "@/types/customer";

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

interface Props {
  open: boolean;

  customer:
    Customer | null;

  onOpenChange:
    (open: boolean) => void;

  onSaved:
    (customer: Customer) => void;
}

export function VehicleFormDialog({
  open,
  customer,
  onOpenChange,
  onSaved,
}: Props) {
  const [
    brand,
    setBrand,
  ] = useState("");

  const [
    model,
    setModel,
  ] = useState("");

  const [
    year,
    setYear,
  ] = useState("");

  const [
    plate,
    setPlate,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);

  const submit =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (!customer) {
        return;
      }

      setSaving(true);

      try {
        const response =
          await fetch(
            `/api/customers/${customer.id}/vehicles`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  brand,
                  model,

                  year:
                    year
                      ? Number(
                          year
                        )
                      : undefined,

                  plate,
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

        setBrand("");
        setModel("");
        setYear("");
        setPlate("");

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Araç Ekle
          </DialogTitle>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={
            submit
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Marka *
              </Label>

              <Input
                value={brand}
                onChange={(e) =>
                  setBrand(
                    e.target.value
                  )
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label>
                Model *
              </Label>

              <Input
                value={model}
                onChange={(e) =>
                  setModel(
                    e.target.value
                  )
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label>
                Yıl
              </Label>

              <Input
                type="number"
                value={year}
                onChange={(e) =>
                  setYear(
                    e.target.value
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                Plaka
              </Label>

              <Input
                value={plate}
                onChange={(e) =>
                  setPlate(
                    e.target.value
                  )
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() =>
                onOpenChange(
                  false
                )
              }
            >
              Vazgeç
            </Button>

            <Button
              type="submit"
              disabled={
                saving
              }
            >
              Araç Ekle
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}