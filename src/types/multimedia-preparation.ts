import type {
  SystemPreparation,
  SystemPreparationPayload,
} from "@/types/system-preparation";

export type MultimediaPreparationMode =
  | "framed"
  | "vehicle_specific";

export interface MultimediaPreparation
  extends SystemPreparation {
  automaticDiscount?: boolean;
  multimediaMode: MultimediaPreparationMode;
  vehicleBrandId: string;
  vehicleBrandName: string;
  vehicleModelId: string;
  vehicleModelName: string;
  vehicleGenerationId: string;
  vehicleGenerationName: string;
  vehicleStartYear: number;
  vehicleEndYear: number;

  multimediaProductId?: string;
  multimediaScreenSize?: string;
  multimediaRam?: string;
  multimediaStorage?: string;
  additionalDescription?: string;
}

export interface MultimediaPreparationPayload
  extends Omit<SystemPreparationPayload, "name"> {
  automaticDiscount?: boolean;
  multimediaMode: MultimediaPreparationMode;
  vehicleBrandId: string;
  vehicleModelId: string;
  vehicleGenerationId: string;
  additionalDescription?: string;
}
