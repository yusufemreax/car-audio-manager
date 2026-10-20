import { ObjectId } from "mongodb";
import { getMultimediaPreparationsCollection } from "@/lib/multimedia-preparations-collection";

interface OfferWithImageSource {
  offerType?: unknown;
  readySystemId?: unknown;
  systemSnapshot?: unknown;
}
function snapshotOf(offer: OfferWithImageSource): Record<string, unknown> {
  return offer.systemSnapshot && typeof offer.systemSnapshot === "object"
    ? offer.systemSnapshot as Record<string, unknown> : {};
}
/** Enrich old offers in one query; do not alter their stored financial snapshots. */
export async function attachOfferInstallationImages<T extends OfferWithImageSource>(offers: T[]): Promise<T[]> {
  const sourceIds = [...new Set(offers.filter(offer =>
    offer.offerType === "multimedia" && !snapshotOf(offer).installationImageUrl
  ).map(offer => String(offer.readySystemId)).filter(id => ObjectId.isValid(id)))];
  if (!sourceIds.length) return offers;
  const collection = await getMultimediaPreparationsCollection();
  const sources = await collection.find({ _id: { $in: sourceIds.map(id => new ObjectId(id)) } }, {
    projection: { installationImageUrl: 1, installationImagePublicId: 1 },
  }).toArray();
  const byId = new Map(sources.map(source => [source._id.toString(), source]));
  return offers.map(offer => {
    const snapshot = snapshotOf(offer);
    if (offer.offerType !== "multimedia" || snapshot.installationImageUrl) return offer;
    const source = byId.get(String(offer.readySystemId));
    if (!source?.installationImageUrl || !source.installationImagePublicId) return offer;
    return { ...offer, systemSnapshot: { ...snapshot,
      installationImageUrl: source.installationImageUrl,
      installationImagePublicId: source.installationImagePublicId,
    } };
  });
}
