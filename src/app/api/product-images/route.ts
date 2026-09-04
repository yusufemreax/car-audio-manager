import {
  NextRequest,
  NextResponse,
} from "next/server";

import type {
  UploadApiResponse,
} from "cloudinary";

import {
  cloudinary,
} from "@/lib/cloudinary";

/*
 * Cloudinary Node SDK kullandığımız için
 * Node runtime.
 */
export const runtime =
  "nodejs";

/*
 * =========================================================
 * CONFIG
 * =========================================================
 */

const MAX_FILE_SIZE =
  5 * 1024 * 1024;

const ALLOWED_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

/*
 * =========================================================
 * UPLOAD BUFFER
 * =========================================================
 */

function uploadImage(
  buffer: Buffer
): Promise<UploadApiResponse> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const stream =
        cloudinary.uploader.upload_stream(
          {
            folder:
              "car-audio-manager/products",

            resource_type:
              "image",

            /*
             * Cloudinary'de saklanan ana
             * görseli de gereksiz büyük
             * tutmuyoruz.
             */
            format:
              "webp",

            transformation: [
              {
                width:
                  1600,

                height:
                  1600,

                crop:
                  "limit",

                quality:
                  "auto:good",
              },
            ],
          },
          (
            error,
            result
          ) => {
            if (
              error
            ) {
              reject(
                error
              );

              return;
            }

            if (
              !result
            ) {
              reject(
                new Error(
                  "Cloudinary upload sonucu alınamadı."
                )
              );

              return;
            }

            resolve(
              result
            );
          }
        );

      stream.end(
        buffer
      );
    }
  );
}

/*
 * =========================================================
 * POST
 *
 * PRODUCT IMAGE UPLOAD
 * =========================================================
 */

export async function POST(
  request:
    NextRequest
) {
  try {
    const formData =
      await request.formData();

    const file =
      formData.get(
        "file"
      );

    if (
      !(file instanceof File)
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Resim dosyası bulunamadı.",
        },
        {
          status:
            400,
        }
      );
    }

    /*
     * TYPE
     */
    if (
      !ALLOWED_TYPES.has(
        file.type
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Sadece JPG, PNG veya WEBP resimleri yüklenebilir.",
        },
        {
          status:
            400,
        }
      );
    }

    /*
     * SIZE
     */
    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Resim boyutu maksimum 5 MB olabilir.",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      file.size ===
      0
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Boş resim dosyası yüklenemez.",
        },
        {
          status:
            400,
        }
      );
    }

    /*
     * FILE -> BUFFER
     */
    const arrayBuffer =
      await file.arrayBuffer();

    const buffer =
      Buffer.from(
        arrayBuffer
      );

    /*
     * CLOUDINARY
     */
    const uploaded =
      await uploadImage(
        buffer
      );

    return NextResponse.json(
      {
        success:
          true,

        data: {
          imageUrl:
            uploaded.secure_url,

          imagePublicId:
            uploaded.public_id,

          width:
            uploaded.width,

          height:
            uploaded.height,

          bytes:
            uploaded.bytes,
        },
      }
    );
  } catch (
    error
  ) {
    console.error(
      "Product image upload error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        message:
          "Ürün resmi yüklenemedi.",
      },
      {
        status:
          500,
      }
    );
  }
}

/*
 * =========================================================
 * DELETE
 *
 * CLOUDINARY IMAGE DELETE
 * =========================================================
 */

export async function DELETE(
  request:
    NextRequest
) {
  try {
    const body =
      (await request.json()) as {
        publicId?: string;
      };

    const publicId =
      body.publicId
        ?.trim();

    if (
      !publicId
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Silinecek resim bulunamadı.",
        },
        {
          status:
            400,
        }
      );
    }

    const result =
      await cloudinary.uploader.destroy(
        publicId,
        {
          resource_type:
            "image",

          /*
           * CDN cache'i de
           * temizlensin.
           */
          invalidate:
            true,
        }
      );

    return NextResponse.json(
      {
        success:
          true,

        data: {
          result:
            result.result,
        },
      }
    );
  } catch (
    error
  ) {
    console.error(
      "Product image delete error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        message:
          "Ürün resmi silinemedi.",
      },
      {
        status:
          500,
      }
    );
  }
}