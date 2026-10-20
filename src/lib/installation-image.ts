/** Accept only images served by this application's Cloudinary account. */
export function validateInstallationImage(imageUrl: string, imagePublicId: string) {
  if (!imageUrl && !imagePublicId) return;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  let url: URL;
  try { url = new URL(imageUrl); } catch { throw new Error("Montaj görüntüsü adresi geçersiz."); }
  if (!cloudName || url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" ||
      url.port || url.username || url.password || url.search || url.hash ||
      !url.pathname.startsWith(`/${cloudName}/image/upload/`) ||
      !imagePublicId.startsWith("car-audio-manager/products/")) {
    throw new Error("Montaj görüntüsünü uygulama üzerinden yükleyin.");
  }
  const imagePath = url.pathname.split("/image/upload/")[1];
  // Upload endpoint returns the original versioned WebP URL, without transformations.
  const publicPath = imagePath.replace(/^v\d+\//, "").replace(/\.[^/.]+$/, "");
  if (publicPath !== imagePublicId) throw new Error("Montaj görüntüsü bilgileri eşleşmiyor.");
}
