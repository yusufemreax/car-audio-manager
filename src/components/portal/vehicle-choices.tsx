"use client";
import { useEffect, useState } from "react";
import type { PortalVehicle } from "@/types/portal";
import { fieldClass, portalFetch } from "./shared";
import { VehicleRequestButton } from "./vehicle-request";
export interface VehicleChoice {
  key?: string;
  generationId: string;
  plate: string;
}
export function VehicleChoices({
  value,
  onChange,
  disabled,
}: {
  value: VehicleChoice[];
  onChange: (value: VehicleChoice[]) => void;
  disabled?: boolean;
}) {
  const [catalog, setCatalog] = useState<PortalVehicle[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void portalFetch<PortalVehicle[]>("/api/portal/vehicles")
      .then((data) => {
        if (active) setCatalog(data);
      })
      .catch(() => {
        if (active) setError("Araç kataloğu yüklenemedi. Sayfayı yenileyin.");
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <fieldset
      disabled={disabled}
      className="space-y-4 rounded-2xl border border-slate-200 p-4"
    >
      <legend className="px-2 font-bold">Araçlarım</legend>
      <p className="text-sm text-slate-500">
        En az bir araç seçin. İsterseniz birden fazla araç ekleyebilirsiniz.
        Plaka isteğe bağlıdır.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {value.map((choice, index) => (
        <VehicleRow
          key={choice.key ?? "initial"}
          catalog={catalog}
          choice={choice}
          index={index}
          onChange={(next) =>
            onChange(value.map((item, i) => (i === index ? next : item)))
          }
          onRemove={
            value.length > 1
              ? () => onChange(value.filter((_, i) => i !== index))
              : undefined
          }
        />
      ))}
      <button
        type="button"
        disabled={value.length >= 10 || disabled}
        className="text-sm font-bold text-amber-700 disabled:opacity-40"
        onClick={() =>
          onChange([
            ...value,
            {
              key: `${Date.now()}-${Math.random()}`,
              generationId: "",
              plate: "",
            },
          ])
        }
      >
        + Başka araç ekle
      </button>
      <div>
        <VehicleRequestButton />
      </div>
    </fieldset>
  );
}
function VehicleRow({
  catalog,
  choice,
  index,
  onChange,
  onRemove,
}: {
  catalog: PortalVehicle[];
  choice: VehicleChoice;
  index: number;
  onChange: (choice: VehicleChoice) => void;
  onRemove?: () => void;
}) {
  const [brandId, setBrandId] = useState("");
  const [modelId, setModelId] = useState("");
  const brand = catalog.find((item) => item.id === brandId);
  const model = brand?.models.find((item) => item.id === modelId);
  return (
    <div className="space-y-3 border-b border-slate-100 pb-4">
      <div className="flex justify-between text-sm font-semibold">
        <span>{index + 1}. araç</span>
        {onRemove && (
          <button type="button" className="text-red-600" onClick={onRemove}>
            Kaldır
          </button>
        )}
      </div>
      <label className="block text-sm">
        Marka
        <select
          aria-label={`${index + 1}. araç markası`}
          required
          className={fieldClass}
          value={brandId}
          onChange={(event) => {
            setBrandId(event.target.value);
            setModelId("");
            onChange({ ...choice, generationId: "" });
          }}
        >
          <option value="">Marka seçin</option>
          {catalog.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Model
        <select
          aria-label={`${index + 1}. araç modeli`}
          required
          disabled={!brand}
          className={fieldClass}
          value={modelId}
          onChange={(event) => {
            setModelId(event.target.value);
            onChange({ ...choice, generationId: "" });
          }}
        >
          <option value="">Model seçin</option>
          {brand?.models.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Kasa
        <select
          aria-label={`${index + 1}. araç kasası`}
          required
          disabled={!model}
          className={fieldClass}
          value={choice.generationId}
          onChange={(event) =>
            onChange({ ...choice, generationId: event.target.value })
          }
        >
          <option value="">Kasa seçin</option>
          {model?.generations.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.startYear}–{item.endYear}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Plaka (isteğe bağlı)
        <input
          className={fieldClass}
          maxLength={30}
          value={choice.plate}
          onChange={(event) =>
            onChange({ ...choice, plate: event.target.value })
          }
          placeholder="41 ABC 123"
        />
      </label>
    </div>
  );
}
