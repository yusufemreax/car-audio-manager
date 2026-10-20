"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export interface InstallationImage { imageUrl: string; imagePublicId: string }
export function InstallationImageField({ value, onChange, busy, onBusyChange, disabled = false }: {
  value: InstallationImage | null;
  onChange: (value: InstallationImage | null) => void;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="max-w-2xl space-y-2">
      <Label htmlFor="installation-image">Örnek Montaj Görüntüsü (Opsiyonel)</Label>
      <Input id="installation-image" type="file" accept="image/jpeg,image/png,image/webp"
        disabled={disabled || busy}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setError(null);
          if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) {
            setError("En fazla 5 MB boyutunda JPG, PNG veya WEBP fotoğraf seçin.");
            return;
          }
          onBusyChange(true);
          try {
            const form = new FormData();
            form.append("file", file);
            const response = await fetch("/api/product-images", { method: "POST", body: form });
            const result = await response.json();
            if (!response.ok || !result.success || !result.data?.imageUrl || !result.data?.imagePublicId) {
              throw new Error(result.message ?? "Montaj fotoğrafı yüklenemedi.");
            }
            onChange({ imageUrl: result.data.imageUrl, imagePublicId: result.data.imagePublicId });
          } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : "Montaj fotoğrafı yüklenemedi.");
          } finally { onBusyChange(false); }
        }} />
      {busy && <p className="text-sm text-muted-foreground">Fotoğraf yükleniyor...</p>}
      {value && <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value.imageUrl} alt="Örnek montaj" className="max-h-48 max-w-full rounded-lg border object-contain" />
        <Button type="button" variant="outline" disabled={disabled || busy} onClick={() => { onChange(null); setError(null); }}>Fotoğrafı Kaldır</Button>
      </div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
