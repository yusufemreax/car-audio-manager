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

import {
  Textarea,
} from "@/components/ui/textarea";

interface Props {
  open: boolean;

  onOpenChange:
    (open: boolean) => void;

  onCreated:
    (customer: Customer) => void;
}

export function CustomerFormDialog({
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const [
    name,
    setName,
  ] = useState("");

  const [
    phone,
    setPhone,
  ] = useState("");

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    notes,
    setNotes,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const submit =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      setSaving(true);
      setError(null);

      try {
        const response =
          await fetch(
            "/api/customers",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  name,
                  phone,
                  email,
                  notes,
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

        onCreated(
          result.data
        );

        setName("");
        setPhone("");
        setEmail("");
        setNotes("");

        onOpenChange(false);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Müşteri oluşturulamadı."
        );
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
            Yeni Müşteri
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={
            submit
          }
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>
              Müşteri Adı *
            </Label>

            <Input
              value={name}
              onChange={(e) =>
                setName(
                  e.target.value
                )
              }
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Telefon
              </Label>

              <Input
                value={phone}
                onChange={(e) =>
                  setPhone(
                    e.target.value
                  )
                }
              />
            </div>

            <div className="space-y-2">
              <Label>
                E-posta
              </Label>

              <Input
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(
                    e.target.value
                  )
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Not
            </Label>

            <Textarea
              value={notes}
              onChange={(e) =>
                setNotes(
                  e.target.value
                )
              }
            />
          </div>

          {error && (
            <div className="text-sm text-destructive">
              {error}
            </div>
          )}

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
              {saving
                ? "Kaydediliyor..."
                : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}