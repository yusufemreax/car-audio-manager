import type {
  Collection,
  ObjectId,
  WithId,
} from "mongodb";

import {
  getDatabase,
} from "@/lib/mongodb";

import {
  serializeSystemPreparation,
  type SystemPreparationDocument,
} from "@/lib/system-preparations-collection";

import type {
  MultimediaPreparation,
} from "@/types/multimedia-preparation";

export interface MultimediaPreparationDocument
  extends SystemPreparationDocument {
  vehicleBrandId: ObjectId;
  vehicleBrandName: string;
  vehicleModelId: ObjectId;
  vehicleModelName: string;
  vehicleGenerationId: ObjectId;
  vehicleGenerationName: string;
  vehicleStartYear: number;
  vehicleEndYear: number;

  multimediaProductId?: ObjectId;
  multimediaScreenSize?: string;
  multimediaRam?: string;
  multimediaStorage?: string;
  additionalDescription?: string;
}

let indexPromise: Promise<void> | null = null;

async function ensureIndexes(
  collection: Collection<MultimediaPreparationDocument>
) {
  if (!indexPromise) {
    indexPromise = Promise.all([
      collection.createIndex(
        { status: 1, createdAt: -1 },
        { name: "ix_multimedia_status_created" }
      ),
      collection.createIndex(
        {
          vehicleBrandId: 1,
          vehicleModelId: 1,
          vehicleGenerationId: 1,
          status: 1,
        },
        { name: "ix_multimedia_vehicle_status" }
      ),
    ])
      .then(() => undefined)
      .catch((error) => {
        indexPromise = null;
        throw error;
      });
  }

  await indexPromise;
}

export async function getMultimediaPreparationsCollection():
  Promise<Collection<MultimediaPreparationDocument>> {
  const db = await getDatabase();
  const collection =
    db.collection<MultimediaPreparationDocument>(
      "multimediaPreparations"
    );

  await ensureIndexes(collection);
  return collection;
}

export function serializeMultimediaPreparation(
  preparation: WithId<MultimediaPreparationDocument>
): MultimediaPreparation {
  const base = serializeSystemPreparation(preparation);

  return {
    ...base,
    vehicleBrandId:
      preparation.vehicleBrandId.toString(),
    vehicleBrandName:
      preparation.vehicleBrandName,
    vehicleModelId:
      preparation.vehicleModelId.toString(),
    vehicleModelName:
      preparation.vehicleModelName,
    vehicleGenerationId:
      preparation.vehicleGenerationId.toString(),
    vehicleGenerationName:
      preparation.vehicleGenerationName,
    vehicleStartYear:
      preparation.vehicleStartYear,
    vehicleEndYear:
      preparation.vehicleEndYear,
    ...(preparation.multimediaProductId
      ? {
          multimediaProductId:
            preparation.multimediaProductId.toString(),
        }
      : {}),
    ...(preparation.multimediaScreenSize
      ? {
          multimediaScreenSize:
            preparation.multimediaScreenSize,
        }
      : {}),
    ...(preparation.multimediaRam
      ? {
          multimediaRam:
            preparation.multimediaRam,
        }
      : {}),
    ...(preparation.multimediaStorage
      ? {
          multimediaStorage:
            preparation.multimediaStorage,
        }
      : {}),
    ...(preparation.additionalDescription
      ? {
          additionalDescription:
            preparation.additionalDescription,
        }
      : {}),
  };
}
