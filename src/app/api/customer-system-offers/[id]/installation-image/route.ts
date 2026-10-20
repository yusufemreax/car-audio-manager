import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getCustomerSystemOffersCollection, serializeCustomerSystemOffer } from "@/lib/customer-system-offers-collection";
import { attachOfferInstallationImages } from "@/lib/offer-installation-images";
import { validateInstallationImage } from "@/lib/installation-image";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ success: false, message: "Geçersiz teklif ID." }, { status: 400 });
    const collection = await getCustomerSystemOffersCollection();
    const document = await collection.findOne({ _id: new ObjectId(id) });
    if (!document) return NextResponse.json({ success: false, message: "Teklif bulunamadı." }, { status: 404 });
    const [offer] = await attachOfferInstallationImages([serializeCustomerSystemOffer(document)]);
    const image = offer.systemSnapshot;
    if (!image.installationImageUrl || !image.installationImagePublicId) {
      return NextResponse.json({ success: false, message: "Örnek montaj görüntüsü bulunamadı." }, { status: 404 });
    }
    validateInstallationImage(image.installationImageUrl, image.installationImagePublicId);
    const url = new URL(image.installationImageUrl);
    // Convert the stored photo to JPEG for convenient sharing and downloading.
    url.pathname = url.pathname.replace("/image/upload/", "/image/upload/f_jpg/");
    const response = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
      throw new Error("Montaj fotoğrafı indirilemedi.");
    }
    const maxSize = 10 * 1024 * 1024;
    if (Number(response.headers.get("content-length")) > maxSize) throw new Error("Montaj fotoğrafı çok büyük.");
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > maxSize) throw new Error("Montaj fotoğrafı çok büyük.");
    return new Response(bytes, { headers: {
      "Content-Type": response.headers.get("content-type")!,
      "Content-Disposition": `attachment; filename="ornek-montaj-${id}.jpg"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    console.error("Installation image download failed:", error);
    return NextResponse.json({ success: false, message: "Örnek montaj görüntüsü indirilemedi." }, { status: 502 });
  }
}
