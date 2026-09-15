import type {
  SystemPreparation,
  SystemPreparationPayload,
} from "@/types/system-preparation";

export interface MultimediaPreparation
  extends SystemPreparation {
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
}

export interface MultimediaPreparationPayload
  extends Omit<SystemPreparationPayload, "name"> {
  vehicleBrandId: string;
  vehicleModelId: string;
  vehicleGenerationId: string;
}
